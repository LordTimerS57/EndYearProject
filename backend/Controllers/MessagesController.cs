using System.IdentityModel.Tokens.Jwt;
using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.DTOs;
using backend.Models;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly FileStorageService _fileStorage;

    public MessagesController(AppDbContext context, FileStorageService fileStorage)
    {
        _context = context;
        _fileStorage = fileStorage;
    }

    private string? GetMatricule() =>
        User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

    // ---------------------------------------------------------
    // 1. RÉCEPTION DES MESSAGES
    // ---------------------------------------------------------
   
    // ---------------------------------------------------------
    [HttpGet("reception")]
    public async Task<IActionResult> Reception([FromQuery] string dossier = "boite", CancellationToken cancellationToken = default)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var dossierNorm = (dossier ?? "boite").Trim().ToLowerInvariant();

        // Un message en corbeille depuis plus longtemps que la durée de rétention
        // n'est plus affiché, même si la tâche de nettoyage n'est pas encore passée.
        var limiteCorbeille = DateTime.UtcNow.AddDays(-CorbeilleParametres.JoursRetention);

        var requete = _context.Messages.AsNoTracking().AsQueryable();

        switch (dossierNorm)
        {
            case "envoyes":
                // Messages que j'ai envoyés et que je n'ai ni archivés, ni supprimés
                requete = requete.Where(m => m.MatriculeExpediteur == matricule
                    && m.Statut != "Brouillon"
                    && _context.Messages.Any(i => i.IdConv == m.IdConv
                        && i.IdMessParent == null
                        && i.MatriculeExpediteur == matricule)
                    && !_context.MessagesUtilisateur.Any(s => s.IdMess == m.IdMess && s.Matricule == matricule));
                break;

            case "archive":
                requete = requete.Where(m =>
                    (m.MatriculeExpediteur == matricule || m.Recepteurs.Any(r => r.Matricule == matricule))
                    && _context.MessagesUtilisateur.Any(s => s.IdMess == m.IdMess
                        && s.Matricule == matricule && s.Etat == EtatMessage.Archive));
                break;

            case "corbeille":
                // Reçus ET envoyés : un message envoyé mis à la corbeille doit y apparaître aussi
                requete = requete.Where(m =>
                    (m.MatriculeExpediteur == matricule || m.Recepteurs.Any(r => r.Matricule == matricule))
                    && _context.MessagesUtilisateur.Any(s => s.IdMess == m.IdMess
                        && s.Matricule == matricule && s.Etat == EtatMessage.Corbeille
                        && s.DateEtat >= limiteCorbeille));
                break;

            default:
                // Boîte de réception : messages reçus sans aucun état
                requete = requete.Where(m => m.Recepteurs.Any(r => r.Matricule == matricule)
                    && !_context.MessagesUtilisateur.Any(s => s.IdMess == m.IdMess && s.Matricule == matricule));
                break;
        }

        var messages = await requete
            .OrderByDescending(m => m.DateEnvoi)
            .Select(m => new
            {
                m.IdMess,
                m.IdConv,
                Objet = m.Conversation.Objet,
                m.Contenu,
                m.DateEnvoi,
                m.Statut,
                m.IdMessParent,
                Expediteur = new
                {
                    m.Expediteur.Matricule,
                    m.Expediteur.Nom,
                    m.Expediteur.Prenom,
                    m.Expediteur.Email,
                    m.Expediteur.Fonction
                },
                Destinataires = m.Recepteurs.Select(r => r.Matricule).ToList(),
                // Date à laquelle le message a été archivé / mis à la corbeille (pour moi)
                DateEtat = _context.MessagesUtilisateur
                    .Where(s => s.IdMess == m.IdMess && s.Matricule == matricule)
                    .Select(s => (DateTime?)s.DateEtat)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        // Noms des destinataires (affichés dans "Messages envoyés")
        var matriculesDest = messages.SelectMany(m => m.Destinataires).Distinct().ToList();
        var noms = await _context.Utilisateurs
            .AsNoTracking()
            .Where(u => matriculesDest.Contains(u.Matricule))
            .Select(u => new { u.Matricule, u.Nom, u.Prenom })
            .ToDictionaryAsync(u => u.Matricule, cancellationToken);

        var idMessages = messages.Select(m => m.IdMess).ToList();

        var piecesJointes = await _context.PiecesJointes
            .AsNoTracking()
            .Where(p => idMessages.Contains(p.IdMess))
            .Select(p => new
            {
                p.IdPiece,
                p.IdMess,
                p.NomFichier,
                p.TypeMime,
                p.TailleFichier,
                p.DateAjout
            })
            .ToListAsync(cancellationToken);

        var resultatFinal = messages.Select(m => new
        {
            m.IdMess,
            m.IdConv,
            m.Objet,
            m.Contenu,
            m.DateEnvoi,
            m.Statut,
            m.IdMessParent,
            m.Expediteur,
            Destinataires = m.Destinataires
                .Select(d => noms.TryGetValue(d, out var u)
                    ? new { Matricule = d, Nom = u.Nom, Prenom = u.Prenom }
                    : new { Matricule = d, Nom = "", Prenom = "" })
                .ToList(),
            m.DateEtat,
            // Échéance de suppression définitive (uniquement dans la corbeille)
            ExpireLe = dossierNorm == "corbeille" && m.DateEtat.HasValue
                ? m.DateEtat.Value.AddDays(CorbeilleParametres.JoursRetention)
                : (DateTime?)null,
            PiecesJointes = piecesJointes
                .Where(p => p.IdMess == m.IdMess)
                .Select(p => new
                {
                    p.IdPiece,
                    p.NomFichier,
                    p.TypeMime,
                    p.TailleFichier,
                    p.DateAjout
                })
                .ToList()
        });

        return Ok(resultatFinal);
    }

    // ---------------------------------------------------------
    // 2. AFFICHER UNE CONVERSATION COMPLÈTE (fil de discussion)
    // ---------------------------------------------------------
    [HttpGet("conversation/{idConv:long}")]
    public async Task<IActionResult> GetConversation(long idConv, CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var conversation = await _context.Conversations
            .AsNoTracking()
            .Where(c => c.IdConv == idConv)
            .Select(c => new { c.IdConv, c.Objet, c.DateCreation })
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation == null)
            return NotFound(new { message = "Conversation introuvable." });

        var limiteCorbeille = DateTime.UtcNow.AddDays(-CorbeilleParametres.JoursRetention);

        // Seuls les messages auxquels l'utilisateur participe sont visibles.
        // Les messages supprimés définitivement (ou dont le délai de corbeille
        // est dépassé) sont masqués.
        var messages = await _context.Messages
            .AsNoTracking()
            .Where(m => m.IdConv == idConv
                        && (m.MatriculeExpediteur == matricule
                            || m.Recepteurs.Any(r => r.Matricule == matricule))
                        && (m.Statut != "Brouillon" || m.MatriculeExpediteur == matricule)
                        && !_context.MessagesUtilisateur.Any(s => s.IdMess == m.IdMess
                            && s.Matricule == matricule
                            && (s.Etat == EtatMessage.Supprime
                                || (s.Etat == EtatMessage.Corbeille && s.DateEtat < limiteCorbeille))))
            .OrderBy(m => m.DateEnvoi)
            .Select(m => new
            {
                m.IdMess,
                m.Contenu,
                m.DateEnvoi,
                m.Statut,
                m.IdMessParent,
                Expediteur = new
                {
                    m.Expediteur.Matricule,
                    m.Expediteur.Nom,
                    m.Expediteur.Prenom,
                    m.Expediteur.Email
                },
                Destinataires = m.Recepteurs.Select(r => r.Matricule).ToList()
            })
            .ToListAsync(cancellationToken);

        // Conversation entièrement supprimée ou inaccessible : on la traite comme introuvable
        if (!messages.Any())
            return NotFound(new { message = "Conversation introuvable." });

        var idMessages = messages.Select(m => m.IdMess).ToList();

        var piecesJointes = await _context.PiecesJointes
            .AsNoTracking()
            .Where(p => idMessages.Contains(p.IdMess))
            .Select(p => new { p.IdPiece, p.IdMess, p.NomFichier, p.TypeMime, p.TailleFichier, p.DateAjout })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            conversation.IdConv,
            conversation.Objet,
            conversation.DateCreation,
            Messages = messages.Select(m => new
            {
                m.IdMess,
                m.Contenu,
                m.DateEnvoi,
                m.Statut,
                m.IdMessParent,
                m.Expediteur,
                m.Destinataires,
                PiecesJointes = piecesJointes
                    .Where(p => p.IdMess == m.IdMess)
                    .Select(p => new { p.IdPiece, p.NomFichier, p.TypeMime, p.TailleFichier, p.DateAjout })
                    .ToList()
            })
        });
    }


    // ---------------------------------------------------------
    // 3. ENVOI D'UN NOUVEAU MESSAGE (OU RÉPONSE)
    // ---------------------------------------------------------
    [HttpPost("envoyer")]
    public async Task<IActionResult> Envoyer([FromBody] EnvoyerMessageDto dto, CancellationToken cancellationToken)
    {
        var matriculeExpediteur = GetMatricule();
        if (string.IsNullOrWhiteSpace(matriculeExpediteur))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Contenu))
            return BadRequest(new { message = "Le contenu est obligatoire." });

        var destinataires = (dto.MatriculesDestinataires ?? new List<string>())
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct()
            .ToList();

        Conversation conversationCible;

        if (dto.IdMessParent.HasValue)
        {
            // --- CAS D'UNE RÉPONSE ---
            var messageParent = await _context.Messages
                .Include(m => m.Conversation)
                .Include(m => m.Recepteurs)
                .FirstOrDefaultAsync(m => m.IdMess == dto.IdMessParent.Value, cancellationToken);

            if (messageParent == null)
                return NotFound(new { message = "Message parent introuvable." });

            // On ne peut répondre qu'à un message auquel on participe
            var aAcces = messageParent.MatriculeExpediteur == matriculeExpediteur
                         || messageParent.Recepteurs.Any(r => r.Matricule == matriculeExpediteur);
            if (!aAcces)
                return Forbid();

            conversationCible = messageParent.Conversation;

            // Sans destinataire précisé : on répond à l'expéditeur du parent
            // (ou aux mêmes destinataires si c'est notre propre message)
            if (!destinataires.Any())
            {
                destinataires = messageParent.MatriculeExpediteur != matriculeExpediteur
                    ? new List<string> { messageParent.MatriculeExpediteur }
                    : messageParent.Recepteurs.Select(r => r.Matricule).ToList();
            }
        }
        else
        {
            // --- CAS D'UN NOUVEAU MESSAGE ---
            if (string.IsNullOrWhiteSpace(dto.Objet))
                return BadRequest(new { message = "L'objet est obligatoire pour un nouveau message." });

            conversationCible = new Conversation
            {
                Objet = dto.Objet.Trim(),
                DateCreation = DateTime.UtcNow
            };
        }

        // Vérification de tous les destinataires en une seule requête
        var destinatairesValides = await _context.Utilisateurs
            .Where(u => destinataires.Contains(u.Matricule))
            .Select(u => u.Matricule)
            .ToListAsync(cancellationToken);

        if (!destinatairesValides.Any())
            return BadRequest(new { message = "Aucun destinataire valide." });

        var nouveauMessage = new Message
        {
            Contenu = dto.Contenu,
            DateEnvoi = DateTime.UtcNow,
            Statut = "Envoyé",
            MatriculeExpediteur = matriculeExpediteur,
            Conversation = conversationCible,
            IdMessParent = dto.IdMessParent
        };

        foreach (var matricule in destinatairesValides)
        {
            nouveauMessage.Recepteurs.Add(new Recepteur { Matricule = matricule });
        }

        // EF Core crée la Conversation (si nouvelle), puis le Message, puis les Recepteurs
        _context.Messages.Add(nouveauMessage);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Message envoyé avec succès.",
            IdMess = nouveauMessage.IdMess,
            IdConv = conversationCible.IdConv
        });
    }

    // ---------------------------------------------------------
    // 4. TRANSFÉRER UN MESSAGE
    // Un transfert n'est pas une réponse : il crée une NOUVELLE conversation
    // ---------------------------------------------------------
    [HttpPost("transferer")]
    public async Task<IActionResult> Transferer([FromBody] TransfererMessageDto dto, CancellationToken cancellationToken)
    {
        var matriculeTransmetteur = GetMatricule();
        if (string.IsNullOrWhiteSpace(matriculeTransmetteur))
            return Unauthorized();

        var messageOriginal = await _context.Messages
            .AsNoTracking()
            .Include(m => m.Conversation)
            .Include(m => m.Expediteur)
            .Include(m => m.Recepteurs)
            .FirstOrDefaultAsync(m => m.IdMess == dto.IdMessOriginal, cancellationToken);

        if (messageOriginal == null)
            return NotFound(new { message = "Message original introuvable." });

        var aAcces = messageOriginal.MatriculeExpediteur == matriculeTransmetteur
                     || messageOriginal.Recepteurs.Any(r => r.Matricule == matriculeTransmetteur);
        if (!aAcces)
            return Forbid();

        var destinataires = (dto.MatriculesDestinataires ?? new List<string>())
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct()
            .ToList();

        var destinatairesValides = await _context.Utilisateurs
            .Where(u => destinataires.Contains(u.Matricule))
            .Select(u => u.Matricule)
            .ToListAsync(cancellationToken);

        if (!destinatairesValides.Any())
            return BadRequest(new { message = "Aucun destinataire valide." });

        var objetOriginal = messageOriginal.Conversation.Objet;
        var objetTransfert = objetOriginal.StartsWith("TR:", StringComparison.OrdinalIgnoreCase)
            ? objetOriginal
            : $"TR: {objetOriginal}";

        var contenuTransfert =
            "---------- Message transféré ----------\n" +
            $"De : {messageOriginal.Expediteur.Prenom} {messageOriginal.Expediteur.Nom} ({messageOriginal.Expediteur.Email})\n" +
            $"Date : {messageOriginal.DateEnvoi:dd/MM/yyyy HH:mm}\n" +
            $"Objet : {objetOriginal}\n\n" +
            messageOriginal.Contenu;

        var piecesOriginales = await _context.PiecesJointes
            .AsNoTracking()
            .Where(p => p.IdMess == messageOriginal.IdMess)
            .ToListAsync(cancellationToken);

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // Nouvelle conversation + nouveau message (sans parent)
        var nouveauMessage = new Message
        {
            Contenu = contenuTransfert,
            DateEnvoi = DateTime.UtcNow,
            Statut = "Envoyé",
            MatriculeExpediteur = matriculeTransmetteur,
            IdMessParent = null,
            Conversation = new Conversation
            {
                Objet = objetTransfert,
                DateCreation = DateTime.UtcNow
            }
        };

        foreach (var matricule in destinatairesValides)
        {
            nouveauMessage.Recepteurs.Add(new Recepteur { Matricule = matricule });
        }

        _context.Messages.Add(nouveauMessage);

        // Historique du transfert
        _context.TransfertsMail.Add(new TransfertMail
        {
            IdMessOriginal = messageOriginal.IdMess,
            MatriculeTransmetteur = matriculeTransmetteur,
            DateTransfert = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        // Les pièces jointes suivent le transfert (même fichier sur disque, nouvelle ligne en base)
        foreach (var piece in piecesOriginales)
        {
            _context.PiecesJointes.Add(new PieceJointe
            {
                IdMess = nouveauMessage.IdMess,
                NomFichier = piece.NomFichier,
                CheminFichier = piece.CheminFichier,
                TypeMime = piece.TypeMime,
                TailleFichier = piece.TailleFichier,
                DateAjout = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new
        {
            message = "Message transféré avec succès.",
            IdMess = nouveauMessage.IdMess,
            IdConv = nouveauMessage.IdConv
        });
    }

    // ---------------------------------------------------------
    // RECHERCHE DE DESTINATAIRES (autocomplétion)
    // ---------------------------------------------------------
    [HttpGet("destinataires")]
    public async Task<IActionResult> RechercherDestinataires([FromQuery] string? q, CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var requete = _context.Utilisateurs
            .AsNoTracking()
            .Where(u => u.Matricule != matricule); // on ne s'écrit pas à soi-même

        // Chaque mot tapé doit correspondre à au moins un champ ("jean rak" fonctionne)
        var termes = (q ?? "")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(3);

        foreach (var terme in termes)
        {
            var motif = $"%{terme.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            requete = requete.Where(u =>
                EF.Functions.ILike(u.Nom, motif) ||
                EF.Functions.ILike(u.Prenom, motif) ||
                EF.Functions.ILike(u.Matricule, motif) ||
                EF.Functions.ILike(u.Email, motif));
        }

        var resultats = await requete
            .OrderBy(u => u.Nom).ThenBy(u => u.Prenom)
            .Take(20)
            .Select(u => new { u.Matricule, u.Nom, u.Prenom, u.Fonction })
            .ToListAsync(cancellationToken);

        return Ok(resultats);
    }


    // Ajoutez cette injection dans le constructeur du MessagesController :
    // private readonly FileStorageService _fileStorage;
    // public MessagesController(AppDbContext context, FileStorageService fileStorage) { ... }

    [HttpPost("{idMess:long}/fichiers")]
    [RequestSizeLimit(50 * 1024 * 1024)] // Limite à 50 Mo par requête
    public async Task<IActionResult> AjouterFichiers(
        long idMess,
        [FromForm] List<IFormFile> fichiers,
        CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule)) return Unauthorized();

        // Vérifier que le message existe et que l'utilisateur en est l'expéditeur
        var message = await _context.Messages
            .FirstOrDefaultAsync(m => m.IdMess == idMess, cancellationToken);

        if (message == null) return NotFound(new { message = "Message introuvable." });
        if (message.MatriculeExpediteur != matricule) return Forbid();

        if (fichiers == null || !fichiers.Any())
            return BadRequest(new { message = "Aucun fichier fourni." });

        var fichiersSauvegardes = new List<object>();

        foreach (var fichier in fichiers)
        {
            if (fichier.Length == 0) continue;

            // 1. Sauvegarder sur le disque
            var cheminRelatif = await _fileStorage.SauvegarderFichierAsync(fichier);

            // 2. Sauvegarder en base de données
            var pieceJointe = new PieceJointe
            {
                IdMess = idMess,
                NomFichier = fichier.FileName, // Nom original pour l'affichage
                CheminFichier = cheminRelatif, // Chemin sur le serveur
                TypeMime = fichier.ContentType,
                TailleFichier = fichier.Length,
                DateAjout = DateTime.UtcNow
            };

            _context.PiecesJointes.Add(pieceJointe);
            fichiersSauvegardes.Add(new { pieceJointe.NomFichier, pieceJointe.TailleFichier });
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Fichiers ajoutés avec succès.",
            fichiers = fichiersSauvegardes
        });
    }


    [HttpGet("fichiers/{idPiece:long}")]
    public async Task<IActionResult> TelechargerFichier(long idPiece, CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule)) return Unauthorized();

        var piece = await _context.PiecesJointes
            .Include(p => p.Message)
            .ThenInclude(m => m.Recepteurs)
            .FirstOrDefaultAsync(p => p.IdPiece == idPiece, cancellationToken);

        if (piece == null) return NotFound();

        // Vérification des droits
        var aAcces = piece.Message.MatriculeExpediteur == matricule
                     || piece.Message.Recepteurs.Any(r => r.Matricule == matricule);

        if (!aAcces) return Forbid();

        // Remplacer par votre service de configuration ou l'injection de IConfiguration
        var cheminBase = "C:\\Projet\\StockageFichiers";
        var cheminComplet = Path.Combine(cheminBase, piece.CheminFichier);

        if (!System.IO.File.Exists(cheminComplet))
            return NotFound(new { message = "Fichier physique introuvable." });

        // Renvoie le fichier avec son type MIME (ex: "image/jpeg", "video/mp4", "application/pdf")
        return PhysicalFile(cheminComplet, piece.TypeMime, piece.NomFichier);
    }


    public class ChangerEtatDto
    {
        // "boite" (ou vide) | "archive" | "corbeille" | "supprime"
        public string? Etat { get; set; }
    }

    private static bool TryParseEtat(string? valeur, out EtatMessage? etat)
    {
        etat = null;
        if (string.IsNullOrWhiteSpace(valeur) || valeur.Equals("boite", StringComparison.OrdinalIgnoreCase))
            return true; // retour à la boîte principale

        if (Enum.TryParse<EtatMessage>(valeur, true, out var e) && Enum.IsDefined(e))
        {
            etat = e;
            return true;
        }
        return false;
    }

    private async Task AppliquerEtat(List<long> ids, string matricule, EtatMessage? etat, CancellationToken ct)
    {
        var existants = await _context.MessagesUtilisateur
            .Where(s => s.Matricule == matricule && ids.Contains(s.IdMess))
            .ToListAsync(ct);

        if (etat == null)
        {
            // Restauration : on retire la ligne (sauf si supprimé définitivement)
            _context.MessagesUtilisateur.RemoveRange(existants.Where(e => e.Etat != EtatMessage.Supprime));
        }
        else
        {
            foreach (var id in ids)
            {
                var ligne = existants.FirstOrDefault(e => e.IdMess == id);
                if (ligne == null)
                {
                    _context.MessagesUtilisateur.Add(new MessageUtilisateur
                    {
                        IdMess = id,
                        Matricule = matricule,
                        Etat = etat.Value,
                        DateEtat = DateTime.UtcNow
                    });
                }
                else if (ligne.Etat != EtatMessage.Supprime && ligne.Etat != etat.Value)
                {
                    ligne.Etat = etat.Value;
                    ligne.DateEtat = DateTime.UtcNow;
                }
            }
        }

        await _context.SaveChangesAsync(ct);
    }

    // Changer l'état d'un message (pour moi uniquement)
    [HttpPut("{idMess:long}/etat")]
    public async Task<IActionResult> ChangerEtatMessage(long idMess, [FromBody] ChangerEtatDto dto, CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        if (!TryParseEtat(dto.Etat, out var etat))
            return BadRequest(new { message = "État invalide." });

        var participe = await _context.Messages.AnyAsync(m => m.IdMess == idMess
            && (m.MatriculeExpediteur == matricule || m.Recepteurs.Any(r => r.Matricule == matricule)),
            cancellationToken);

        if (!participe)
            return NotFound(new { message = "Message introuvable." });

        await AppliquerEtat(new List<long> { idMess }, matricule, etat, cancellationToken);
        return NoContent();
    }

    // Changer l'état de toute une conversation (pour moi uniquement)
    [HttpPut("conversation/{idConv:long}/etat")]
    public async Task<IActionResult> ChangerEtatConversation(long idConv, [FromBody] ChangerEtatDto dto, CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        if (!TryParseEtat(dto.Etat, out var etat))
            return BadRequest(new { message = "État invalide." });

        var ids = await _context.Messages
            .Where(m => m.IdConv == idConv
                && (m.MatriculeExpediteur == matricule || m.Recepteurs.Any(r => r.Matricule == matricule))
                && !_context.MessagesUtilisateur.Any(s => s.IdMess == m.IdMess
                    && s.Matricule == matricule && s.Etat == EtatMessage.Supprime))
            .Select(m => m.IdMess)
            .ToListAsync(cancellationToken);

        if (!ids.Any())
            return NotFound(new { message = "Conversation introuvable." });

        await AppliquerEtat(ids, matricule, etat, cancellationToken);
        return NoContent();
    }

    // À AJOUTER dans MessagesController (nouvelle méthode, rien à remplacer).

    // ---------------------------------------------------------
    // MESSAGES ENVOYÉS
    // ---------------------------------------------------------
    // À AJOUTER dans MessagesController (nouvelle méthode, rien à remplacer).

    // ---------------------------------------------------------
    // MESSAGES ENVOYÉS
    // ---------------------------------------------------------
    [HttpGet("envoyes")]
    public async Task<IActionResult> Envoyes(CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var messages = await _context.Messages
            .AsNoTracking()
            .Where(m => m.MatriculeExpediteur == matricule
                        && m.Statut != "Brouillon"
                        // Uniquement les conversations que j'ai ouvertes : leur premier
                        // message (celui sans parent) a été envoyé par moi.
                        // Mes réponses dans la conversation d'un autre n'apparaissent pas ici.
                        && _context.Messages.Any(i => i.IdConv == m.IdConv
                            && i.IdMessParent == null
                            && i.MatriculeExpediteur == matricule)
                        // Masque ceux que j'ai déplacés (archive / corbeille / supprimé).
                        // Sans effet tant que la table MessagesUtilisateur est vide.
                        && !_context.MessagesUtilisateur.Any(s =>
                            s.IdMess == m.IdMess && s.Matricule == matricule))
            .OrderByDescending(m => m.DateEnvoi)
            .Select(m => new
            {
                m.IdMess,
                m.IdConv,
                Objet = m.Conversation.Objet,
                m.Contenu,
                m.DateEnvoi,
                m.Statut,
                m.IdMessParent,
                Destinataires = m.Recepteurs.Select(r => r.Matricule).ToList()
            })
            .ToListAsync(cancellationToken);

        // Noms des destinataires
        var matriculesDest = messages.SelectMany(m => m.Destinataires).Distinct().ToList();
        var noms = await _context.Utilisateurs
            .AsNoTracking()
            .Where(u => matriculesDest.Contains(u.Matricule))
            .Select(u => new { u.Matricule, u.Nom, u.Prenom })
            .ToDictionaryAsync(u => u.Matricule, cancellationToken);

        // Pièces jointes
        var idMessages = messages.Select(m => m.IdMess).ToList();
        var piecesJointes = await _context.PiecesJointes
            .AsNoTracking()
            .Where(p => idMessages.Contains(p.IdMess))
            .Select(p => new
            {
                p.IdPiece,
                p.IdMess,
                p.NomFichier,
                p.TypeMime,
                p.TailleFichier,
                p.DateAjout
            })
            .ToListAsync(cancellationToken);

        var resultat = messages.Select(m => new
        {
            m.IdMess,
            m.IdConv,
            m.Objet,
            m.Contenu,
            m.DateEnvoi,
            m.Statut,
            m.IdMessParent,
            Destinataires = m.Destinataires
                .Select(d => noms.TryGetValue(d, out var u)
                    ? new { Matricule = d, Nom = u.Nom, Prenom = u.Prenom }
                    : new { Matricule = d, Nom = "", Prenom = "" })
                .ToList(),
            PiecesJointes = piecesJointes
                .Where(p => p.IdMess == m.IdMess)
                .Select(p => new
                {
                    p.IdPiece,
                    p.NomFichier,
                    p.TypeMime,
                    p.TailleFichier,
                    p.DateAjout
                })
                .ToList()
        });

        return Ok(resultat);
    }


    // À AJOUTER dans MessagesController (nouvelle méthode, rien à remplacer).
    // Nécessite : using backend.Services;  (déjà présent) et CorbeilleParametres.cs.

    // ---------------------------------------------------------
    // CORBEILLE : conversations mises à la corbeille, avec leur échéance
    // ---------------------------------------------------------
    [HttpGet("corbeille")]
    public async Task<IActionResult> Corbeille(CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        // Au-delà de la durée de rétention, un message n'est plus affiché, même si
        // la tâche de nettoyage n'est pas encore passée.
        var limite = DateTime.UtcNow.AddDays(-CorbeilleParametres.JoursRetention);

        var messages = await _context.Messages
            .AsNoTracking()
            .Where(m => (m.MatriculeExpediteur == matricule
                         || m.Recepteurs.Any(r => r.Matricule == matricule))
                        && _context.MessagesUtilisateur.Any(s =>
                            s.IdMess == m.IdMess
                            && s.Matricule == matricule
                            && s.Etat == EtatMessage.Corbeille
                            && s.DateEtat >= limite))
            .OrderByDescending(m => m.DateEnvoi)
            .Select(m => new
            {
                m.IdMess,
                m.IdConv,
                Objet = m.Conversation.Objet,
                m.Contenu,
                m.DateEnvoi,
                EstMoi = m.MatriculeExpediteur == matricule,
                Expediteur = new
                {
                    m.Expediteur.Matricule,
                    m.Expediteur.Nom,
                    m.Expediteur.Prenom
                },
                Destinataires = m.Recepteurs.Select(r => r.Matricule).ToList(),
                // Date de mise à la corbeille (pour moi)
                DateEtat = _context.MessagesUtilisateur
                    .Where(s => s.IdMess == m.IdMess && s.Matricule == matricule)
                    .Select(s => (DateTime?)s.DateEtat)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        // Noms des destinataires
        var matriculesDest = messages.SelectMany(m => m.Destinataires).Distinct().ToList();
        var noms = await _context.Utilisateurs
            .AsNoTracking()
            .Where(u => matriculesDest.Contains(u.Matricule))
            .Select(u => new { u.Matricule, u.Nom, u.Prenom })
            .ToDictionaryAsync(u => u.Matricule, cancellationToken);

        var resultat = messages.Select(m => new
        {
            m.IdMess,
            m.IdConv,
            m.Objet,
            m.Contenu,
            m.DateEnvoi,
            m.EstMoi,
            m.Expediteur,
            Destinataires = m.Destinataires
                .Select(d => noms.TryGetValue(d, out var u)
                    ? new { Matricule = d, Nom = u.Nom, Prenom = u.Prenom }
                    : new { Matricule = d, Nom = "", Prenom = "" })
                .ToList(),
            m.DateEtat,
            // Échéance de suppression définitive
            ExpireLe = m.DateEtat.HasValue
                ? m.DateEtat.Value.AddDays(CorbeilleParametres.JoursRetention)
                : (DateTime?)null
        });

        return Ok(resultat);
    }
}
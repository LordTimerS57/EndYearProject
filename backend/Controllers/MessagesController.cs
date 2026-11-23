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

        var requete = _context.Messages
            .AsNoTracking()
            .Where(m => m.Statut != StatutMessage.Brouillon)
            .AsQueryable();

        switch (dossierNorm)
        {
            case "envoyes":
                // Messages que j'ai envoyés et que je n'ai ni archivés, ni supprimés
                requete = requete.Where(m => m.MatriculeExpediteur == matricule
                    && m.Statut != StatutMessage.Brouillon
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

    [HttpPost("{idMess:long}/transferer")]
    public async Task<IActionResult> Transferer(
    long idMess,
    [FromBody] TransfertMailDto dto,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        if (dto is null || dto.MatriculesDestinataires is null
            || dto.MatriculesDestinataires.Count == 0)
            return BadRequest(new { message = "Au moins un destinataire est requis." });

        // 1) Message original + autorisations
        var original = await _context.Messages
            .Include(m => m.Conversation)
            .Include(m => m.Recepteurs)
            .Include(m => m.PiecesJointes)
            .Include(m => m.Expediteur)
            .FirstOrDefaultAsync(m => m.IdMess == idMess, cancellationToken);

        if (original is null)
            return NotFound(new { message = "Message introuvable." });

        var aAcces = original.MatriculeExpediteur == matricule
                     || original.Recepteurs.Any(r => r.Matricule == matricule);
        if (!aAcces)
            return Forbid();

        if (original.Statut == StatutMessage.Brouillon)
            return Conflict(new { message = "Un brouillon ne peut pas être transféré." });

        // 2) Destinataires : nettoyage + validation
        var destinataires = dto.MatriculesDestinataires
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (destinataires.Count == 0)
            return BadRequest(new { message = "Au moins un destinataire valide est requis." });

        if (destinataires.Contains(matricule, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = "Vous ne pouvez pas vous transférer un message à vous-même." });

        var existants = await _context.Utilisateurs
            .Where(u => destinataires.Contains(u.Matricule))
            .Select(u => u.Matricule)
            .ToListAsync(cancellationToken);

        var inconnus = destinataires.Except(existants, StringComparer.OrdinalIgnoreCase).ToList();
        if (inconnus.Count > 0)
            return BadRequest(new { message = "Destinataires inconnus.", inconnus });

        // 3) Objet : préfixe "TR : " sans doublon
        var objetOriginal = original.Conversation.Objet;
        const string prefixe = "TR : ";
        var objetTransfere = objetOriginal.StartsWith(prefixe, StringComparison.OrdinalIgnoreCase)
            ? objetOriginal
            : prefixe + objetOriginal;

        // 4) Contenu : [commentaire] + bloc transféré
        var dateEnvoi = original.DateEnvoi ?? DateTime.UtcNow;
        var blocOriginal =
            "---------- Message transféré ----------\n" +
            $"De : {original.Expediteur.Prenom} {original.Expediteur.Nom} ({original.Expediteur.Email})\n" +
            $"Objet : {objetOriginal}\n" +
            $"Date : {dateEnvoi:dd/MM/yyyy HH:mm}\n\n" +
            original.Contenu;

        var contenu = string.IsNullOrWhiteSpace(dto.Commentaire)
            ? blocOriginal
            : dto.Commentaire.Trim() + "\n\n" + blocOriginal;

        // 5) Transaction
        await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);
        var nouveauxChemins = new List<string>();

        try
        {
            // 5a) Nouvelle conversation
            var nouvelleConversation = new Conversation
            {
                Objet = objetTransfere,
                DateCreation = DateTime.UtcNow
            };

            // 5b) Nouveau message
            var nouveauMessage = new Message
            {
                Contenu = contenu,
                DateEnvoi = DateTime.UtcNow,
                DateModification = DateTime.UtcNow,   // si le champ existe (lot brouillon)
                Statut = StatutMessage.Envoye,
                MatriculeExpediteur = matricule,
                Conversation = nouvelleConversation,
                IdMessParent = null
            };

            foreach (var dest in destinataires)
                nouveauMessage.Recepteurs.Add(new Recepteur { Matricule = dest });

            _context.Messages.Add(nouveauMessage);
            await _context.SaveChangesAsync(cancellationToken);   // obtient IdMess + IdConv

            // 5c) Copie physique + nouvelles lignes PieceJointe
            foreach (var pj in original.PiecesJointes)
            {
                var nouveauChemin = await _fileStorage.CopierFichierAsync(pj.CheminFichier, cancellationToken);
                nouveauxChemins.Add(nouveauChemin);

                _context.PiecesJointes.Add(new PieceJointe
                {
                    IdMess = nouveauMessage.IdMess,
                    NomFichier = pj.NomFichier,
                    CheminFichier = nouveauChemin,
                    ObjectKey = string.Empty,       // non utilisé par le stockage local
                    TypeMime = pj.TypeMime,
                    TailleFichier = pj.TailleFichier,
                    DateAjout = DateTime.UtcNow
                });
            }

            // 5d) Historique
            var transfert = new TransfertMail
            {
                IdMessOriginal = original.IdMess,
                IdMessTransfere = nouveauMessage.IdMess,
                MatriculeTransmetteur = matricule,
                DateTransfert = DateTime.UtcNow
            };
            _context.TransfertsMail.Add(transfert);

            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            return StatusCode(StatusCodes.Status201Created, new
            {
                message = "Message transféré.",
                IdTransfert = transfert.IdTransfert,
                IdMessOriginal = original.IdMess,
                IdMessTransfere = nouveauMessage.IdMess,
                IdConv = nouveauMessage.IdConv,
                Destinataires = destinataires,
                DateTransfert = transfert.DateTransfert
            });
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);

            // Nettoyage best-effort des fichiers déjà copiés
            foreach (var chemin in nouveauxChemins)
            {
                try { await _fileStorage.SupprimerFichierAsync(chemin, cancellationToken); }
                catch { /* TODO log */ }
            }
            throw;
        }
    }

    [HttpGet("transferts")]
    public async Task<IActionResult> ListeTransferts(CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var resultats = await _context.TransfertsMail
            .AsNoTracking()
            .Where(t => t.MatriculeTransmetteur == matricule && t.IdMessTransfere != null)
            .OrderByDescending(t => t.DateTransfert)
            .Select(t => new TransfertListeDto
            {
                IdTransfert = t.IdTransfert,
                IdMessOriginal = t.IdMessOriginal,
                IdMessTransfere = t.IdMessTransfere!.Value,
                ObjetOriginal = t.MessageOriginal.Conversation.Objet,
                ObjetTransfere = t.MessageTransfere!.Conversation.Objet,
                DateTransfert = t.DateTransfert,
                Destinataires = t.MessageTransfere!.Recepteurs.Select(r => r.Matricule).ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(resultats);
    }

    [HttpGet("transferts/{idTransfert:long}")]
    public async Task<IActionResult> DetailTransfert(long idTransfert, CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var t = await _context.TransfertsMail
            .AsNoTracking()
            .Include(x => x.MessageOriginal).ThenInclude(m => m.Conversation)
            .Include(x => x.MessageTransfere!).ThenInclude(m => m.Conversation)
            .Include(x => x.MessageTransfere!).ThenInclude(m => m.Recepteurs)
            .Include(x => x.MessageTransfere!).ThenInclude(m => m.PiecesJointes)
            .FirstOrDefaultAsync(x => x.IdTransfert == idTransfert, cancellationToken);

        if (t is null || t.MessageTransfere is null)
            return NotFound();

        if (t.MatriculeTransmetteur != matricule)
            return Forbid();

        // Reconstitution du commentaire depuis le contenu
        const string separateur = "---------- Message transféré ----------";
        string? commentaire = null;
        var idx = t.MessageTransfere.Contenu.IndexOf(separateur, StringComparison.Ordinal);
        if (idx > 0)
            commentaire = t.MessageTransfere.Contenu.Substring(0, idx).TrimEnd();

        return Ok(new TransfertDetailDto
        {
            IdTransfert = t.IdTransfert,
            IdMessOriginal = t.IdMessOriginal,
            IdMessTransfere = t.MessageTransfere.IdMess,
            IdConvTransfere = t.MessageTransfere.IdConv,
            ObjetOriginal = t.MessageOriginal.Conversation.Objet,
            ObjetTransfere = t.MessageTransfere.Conversation.Objet,
            Commentaire = commentaire,
            MatriculeTransmetteur = t.MatriculeTransmetteur,
            DateTransfert = t.DateTransfert,
            Destinataires = t.MessageTransfere.Recepteurs.Select(r => r.Matricule).ToList(),
            PiecesJointes = t.MessageTransfere.PiecesJointes
                .Select(p => new PieceJointeDto
                {
                    IdPiece = p.IdPiece,
                    NomFichier = p.NomFichier,
                    TypeMime = p.TypeMime,
                    TailleFichier = p.TailleFichier,
                    DateAjout = p.DateAjout
                })
                .ToList()
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
                     || (piece.Message.Statut != StatutMessage.Brouillon
                         && piece.Message.Recepteurs.Any(r => r.Matricule == matricule));

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
            .Where(m => m.Statut != StatutMessage.Brouillon
                        && (m.MatriculeExpediteur == matricule
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


    /// <summary>
    /// Charge un brouillon appartenant à l'utilisateur connecté, avec Conversation,
    /// Recepteurs et PiecesJointes. Retourne null si introuvable, non propriétaire,
    /// ou si le statut n'est plus Brouillon.
    /// </summary>
    private async Task<Message?> ChargerBrouillonAsync(
        long idMess,
        string matricule,
        CancellationToken ct)
    {
        return await _context.Messages
            .Include(m => m.Conversation)
            .Include(m => m.Recepteurs)
            .Include(m => m.PiecesJointes)
            .FirstOrDefaultAsync(m =>
                m.IdMess == idMess
                && m.MatriculeExpediteur == matricule
                && m.Statut == StatutMessage.Brouillon,
                ct);
    }


    [HttpPost("brouillons")]
    public async Task<IActionResult> CreerBrouillon(
    [FromBody] BrouillonDto dto,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        if (dto is null)
            return BadRequest(new { message = "Corps de requête invalide." });

        // --- Validation destinataires ---
        var destinataires = (dto.MatriculesDestinataires ?? new List<string>())
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (destinataires.Count > 0)
        {
            var existants = await _context.Utilisateurs
                .Where(u => destinataires.Contains(u.Matricule))
                .Select(u => u.Matricule)
                .ToListAsync(cancellationToken);

            var inconnus = destinataires
                .Except(existants, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (inconnus.Count > 0)
                return BadRequest(new { message = "Destinataires inconnus.", inconnus });
        }

        // --- Conversation + message ---
        Conversation conversation;
        long? idMessParent = null;

        if (dto.IdMessParent is null)
        {
            conversation = new Conversation
            {
                Objet = dto.Objet?.Trim() ?? string.Empty,
                DateCreation = DateTime.UtcNow
            };
            _context.Conversations.Add(conversation);
        }
        else
        {
            var parent = await _context.Messages
                .Include(m => m.Conversation)
                .Include(m => m.Recepteurs)
                .FirstOrDefaultAsync(m => m.IdMess == dto.IdMessParent, cancellationToken);

            if (parent is null)
                return BadRequest(new { message = "Message parent introuvable." });

            var estExpediteur = parent.MatriculeExpediteur == matricule;
            var estDestinataire = parent.Recepteurs.Any(r => r.Matricule == matricule);

            if (!estExpediteur && !estDestinataire)
                return NotFound(); // ne pas divulguer l'existence

            if (parent.Statut == StatutMessage.Brouillon)
                return BadRequest(new { message = "Impossible de répondre à un brouillon." });

            conversation = parent.Conversation;
            idMessParent = parent.IdMess;
        }

        var brouillon = new Message
        {
            Contenu = dto.Contenu ?? string.Empty,
            DateEnvoi = null,
            DateModification = DateTime.UtcNow,
            Statut = StatutMessage.Brouillon,
            MatriculeExpediteur = matricule,
            IdMessParent = idMessParent,
            Conversation = conversation
        };

        foreach (var dest in destinataires)
            brouillon.Recepteurs.Add(new Recepteur { Matricule = dest });

        _context.Messages.Add(brouillon);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(DetailBrouillon),
            new { idMess = brouillon.IdMess },
            new BrouillonReponseDto
            {
                IdMess = brouillon.IdMess,
                IdConv = brouillon.IdConv,
                Statut = brouillon.Statut,
                Message = "Brouillon créé."
            });
    }


    [HttpGet("brouillons")]
    public async Task<IActionResult> ListeBrouillons(CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var brouillons = await _context.Messages
            .AsNoTracking()
            .Where(m => m.MatriculeExpediteur == matricule
                     && m.Statut == StatutMessage.Brouillon)
            .OrderByDescending(m => m.DateModification ?? m.Conversation.DateCreation)
            .Select(m => new BrouillonListeDto
            {
                IdMess = m.IdMess,
                IdConv = m.IdConv,
                Objet = m.Conversation.Objet,
                Apercu = m.Contenu.Length > 200
                    ? m.Contenu.Substring(0, 200)
                    : m.Contenu,
                DateModification = m.DateModification,
                DateCreation = m.Conversation.DateCreation,
                Destinataires = m.Recepteurs.Select(r => r.Matricule).ToList(),
                NombrePiecesJointes = m.PiecesJointes.Count
            })
            .ToListAsync(cancellationToken);

        return Ok(brouillons);
    }


    [HttpGet("brouillons/{idMess:long}")]
    public async Task<IActionResult> DetailBrouillon(
    long idMess,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var b = await ChargerBrouillonAsync(idMess, matricule, cancellationToken);
        if (b is null)
            return NotFound(); // pas 403 : ne pas divulguer l'existence

        var dto = new BrouillonDetailDto
        {
            IdMess = b.IdMess,
            IdConv = b.IdConv,
            Objet = b.Conversation.Objet,
            Contenu = b.Contenu,
            MatriculesDestinataires = b.Recepteurs.Select(r => r.Matricule).ToList(),
            IdMessParent = b.IdMessParent,
            PiecesJointes = b.PiecesJointes
                .Select(p => new PieceJointeDto
                {
                    IdPiece = p.IdPiece,
                    NomFichier = p.NomFichier,
                    TypeMime = p.TypeMime,
                    TailleFichier = p.TailleFichier,
                    DateAjout = p.DateAjout
                })
                .ToList()
        };

        return Ok(dto);
    }


    [HttpPut("brouillons/{idMess:long}")]
    public async Task<IActionResult> ModifierBrouillon(
    long idMess,
    [FromBody] BrouillonDto dto,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        if (dto is null)
            return BadRequest(new { message = "Corps de requête invalide." });

        var brouillon = await ChargerBrouillonAsync(idMess, matricule, cancellationToken);
        if (brouillon is null)
            return NotFound();

        // --- Contenu ---
        if (dto.Contenu is not null)
            brouillon.Contenu = dto.Contenu;

        // --- Objet : uniquement si ce n'est PAS une réponse ---
        if (brouillon.IdMessParent is null && dto.Objet is not null)
            brouillon.Conversation.Objet = dto.Objet.Trim();

        // --- Destinataires (comportement null / [] / [..]) ---
        if (dto.MatriculesDestinataires is not null)
        {
            var nouveaux = dto.MatriculesDestinataires
                .Where(m => !string.IsNullOrWhiteSpace(m))
                .Select(m => m.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Interdit de s'ajouter soi-même (règle de l'app : "on ne s'écrit pas à soi-même")
            if (nouveaux.Contains(matricule, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { message = "L'expéditeur ne peut pas être destinataire." });

            // Vérifier que tous les matricules existent
            if (nouveaux.Count > 0)
            {
                var existants = await _context.Utilisateurs
                    .Where(u => nouveaux.Contains(u.Matricule))
                    .Select(u => u.Matricule)
                    .ToListAsync(cancellationToken);

                var inconnus = nouveaux
                    .Except(existants, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (inconnus.Count > 0)
                    return BadRequest(new { message = "Destinataires inconnus.", inconnus });
            }

            var anciens = brouillon.Recepteurs
                .Select(r => r.Matricule)
                .ToList();

            var aSupprimer = brouillon.Recepteurs
                .Where(r => !nouveaux.Contains(r.Matricule, StringComparer.OrdinalIgnoreCase))
                .ToList();

            if (aSupprimer.Count > 0)
            {
                _context.Recepteurs.RemoveRange(aSupprimer);
                foreach (var r in aSupprimer)
                    brouillon.Recepteurs.Remove(r);
            }

            var aAjouter = nouveaux
                .Except(anciens, StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var dest in aAjouter)
                brouillon.Recepteurs.Add(new Recepteur { Matricule = dest });
        }

        brouillon.DateModification = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new BrouillonReponseDto
        {
            IdMess = brouillon.IdMess,
            IdConv = brouillon.IdConv,
            Statut = brouillon.Statut,
            Message = "Brouillon enregistré."
        });
    }


    [HttpDelete("brouillons/{idMess:long}")]
    public async Task<IActionResult> SupprimerBrouillon(
    long idMess,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var brouillon = await ChargerBrouillonAsync(idMess, matricule, cancellationToken);
        if (brouillon is null)
            return NotFound();

        // On garde les chemins pour supprimer les fichiers APRÈS le commit
        var chemins = brouillon.PiecesJointes
            .Select(p => p.CheminFichier)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .ToList();

        // 1) Suppression en base
        _context.PiecesJointes.RemoveRange(brouillon.PiecesJointes);
        _context.Recepteurs.RemoveRange(brouillon.Recepteurs);
        _context.Messages.Remove(brouillon);

        // Si c'était une réponse (IdMessParent != null), on NE supprime PAS la conversation.
        // Si c'était le SEUL message de sa conversation (brouillon isolé), on la supprime aussi.
        var conversationVide = !await _context.Messages
            .AnyAsync(m => m.IdConv == brouillon.IdConv && m.IdMess != brouillon.IdMess,
                cancellationToken);

        var conversationASupprimer = conversationVide ? brouillon.Conversation : null;
        if (conversationASupprimer is not null)
            _context.Conversations.Remove(conversationASupprimer);

        await _context.SaveChangesAsync(cancellationToken);

        // 2) Suppression physique — après le commit.
        // Si un fichier échoue, on ne casse pas la transaction déjà validée.
        foreach (var chemin in chemins)
        {
            try
            {
                await _fileStorage.SupprimerFichierAsync(chemin, cancellationToken);
            }
            catch
            {
                // On log l'erreur, mais on ne renvoie pas 500 : le brouillon
                // est supprimé côté base, c'est ce qui compte pour l'utilisateur.
                // TODO : injecter ILogger<MessagesController> et logguer.
            }
        }

        return NoContent();
    }


    [HttpPost("brouillons/{idMess:long}/envoyer")]
    public async Task<IActionResult> EnvoyerBrouillon(
    long idMess,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var brouillon = await ChargerBrouillonAsync(idMess, matricule, cancellationToken);
        if (brouillon is null)
            return NotFound();

        // --- Validations à l'envoi (§7.6) ---
        if (string.IsNullOrWhiteSpace(brouillon.Contenu))
            return BadRequest(new { message = "Le contenu est obligatoire pour envoyer." });

        // Pour un nouveau message (pas une réponse) : objet obligatoire
        if (brouillon.IdMessParent is null
            && string.IsNullOrWhiteSpace(brouillon.Conversation.Objet))
            return BadRequest(new { message = "L'objet est obligatoire pour envoyer." });

        var destinataires = brouillon.Recepteurs
            .Select(r => r.Matricule)
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .ToList();

        if (destinataires.Count == 0)
            return BadRequest(new { message = "Au moins un destinataire est requis." });

        // Vérifier que les destinataires existent toujours
        var existants = await _context.Utilisateurs
            .Where(u => destinataires.Contains(u.Matricule))
            .Select(u => u.Matricule)
            .ToListAsync(cancellationToken);

        var inconnus = destinataires
            .Except(existants, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (inconnus.Count > 0)
            return BadRequest(new { message = "Destinataires inconnus.", inconnus });

        // --- Transformation : on modifie LE MÊME message ---
        brouillon.Statut = StatutMessage.Envoye;
        brouillon.DateEnvoi = DateTime.UtcNow;
        brouillon.DateModification = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Double clic / requêtes simultanées : l'une a déjà transformé le brouillon
            return Conflict(new { message = "Ce brouillon a déjà été envoyé ou modifié." });
        }

        return Ok(new BrouillonReponseDto
        {
            IdMess = brouillon.IdMess,
            IdConv = brouillon.IdConv,
            Statut = brouillon.Statut,
            Message = "Brouillon envoyé."
        });
    }


    [HttpDelete("brouillons/{idMess:long}/fichiers/{idPiece:long}")]
    public async Task<IActionResult> SupprimerFichierBrouillon(
    long idMess,
    long idPiece,
    CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var brouillon = await ChargerBrouillonAsync(idMess, matricule, cancellationToken);
        if (brouillon is null)
            return NotFound();

        var piece = brouillon.PiecesJointes
            .FirstOrDefault(p => p.IdPiece == idPiece);

        if (piece is null)
            return NotFound();

        var chemin = piece.CheminFichier;

        _context.PiecesJointes.Remove(piece);
        await _context.SaveChangesAsync(cancellationToken);

        // Suppression physique après commit
        if (!string.IsNullOrWhiteSpace(chemin))
        {
            try
            {
                await _fileStorage.SupprimerFichierAsync(chemin, cancellationToken);
            }
            catch
            {
                // TODO : logguer
            }
        }

        return NoContent();
    }
}
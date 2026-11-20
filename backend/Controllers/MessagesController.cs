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
    [HttpGet("reception")]
    public async Task<IActionResult> Reception(CancellationToken cancellationToken)
    {
        var matricule = GetMatricule();
        if (string.IsNullOrWhiteSpace(matricule))
            return Unauthorized();

        var messages = await _context.Recepteurs
            .AsNoTracking()
            .Where(r => r.Matricule == matricule)
            .OrderByDescending(r => r.Message.DateEnvoi)
            .Select(r => new
            {
                IdMess = r.Message.IdMess,
                IdConv = r.Message.IdConv,
                Objet = r.Message.Conversation.Objet,
                Contenu = r.Message.Contenu,
                DateEnvoi = r.Message.DateEnvoi,
                Statut = r.Message.Statut,
                IdMessParent = r.Message.IdMessParent,
                Expediteur = new
                {
                    r.Message.Expediteur.Matricule,
                    r.Message.Expediteur.Nom,
                    r.Message.Expediteur.Prenom,
                    r.Message.Expediteur.Email,
                    r.Message.Expediteur.Fonction
                }
            })
            .ToListAsync(cancellationToken);

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

        // Seuls les messages auxquels l'utilisateur participe sont visibles
        var messages = await _context.Messages
            .AsNoTracking()
            .Where(m => m.IdConv == idConv
                        && (m.MatriculeExpediteur == matricule
                            || m.Recepteurs.Any(r => r.Matricule == matricule))
                        && (m.Statut != "Brouillon" || m.MatriculeExpediteur == matricule))
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

        if (!messages.Any())
            return Forbid();

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
}
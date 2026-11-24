using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Quartz;

namespace backend.Jobs;

// Toutes les minutes : envoie les brouillons dont la DateEnvoiProgramme est atteinte.
// La base de données est la source de vérité : si le serveur redémarre, les envois
// en retard sont rattrapés au démarrage (le trigger démarre immédiatement).
[DisallowConcurrentExecution]
public class EnvoiProgrammeJob : IJob
{
    private const int TailleLot = 100;

    private readonly AppDbContext _db;
    private readonly ILogger<EnvoiProgrammeJob> _logger;

    public EnvoiProgrammeJob(AppDbContext db, ILogger<EnvoiProgrammeJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async ValueTask Execute(IJobExecutionContext context, CancellationToken cancellationToken)
    {
        var maintenant = DateTime.UtcNow;

        var echus = await _db.Messages
            .Include(m => m.Conversation)
            .Include(m => m.Recepteurs)
            .Where(m => m.Statut == StatutMessage.Brouillon
                        && m.DateEnvoiProgramme != null
                        && m.DateEnvoiProgramme <= maintenant)
            .OrderBy(m => m.DateEnvoiProgramme)
            .Take(TailleLot)
            .ToListAsync(cancellationToken);

        if (echus.Count == 0)
            return;

        // Une seule requête pour vérifier tous les destinataires
        var matricules = echus
            .SelectMany(m => m.Recepteurs.Select(r => r.Matricule))
            .Distinct()
            .ToList();

        var existants = (await _db.Utilisateurs
                .Where(u => matricules.Contains(u.Matricule))
                .Select(u => u.Matricule)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var envoyes = 0;

        foreach (var message in echus)
        {
            var motif = Valider(message, existants);

            if (motif is not null)
            {
                // Le message redevient un brouillon ordinaire (visible dans "Brouillons")
                message.DateEnvoiProgramme = null;
                message.DateModification = maintenant;
                _logger.LogWarning(
                    "Envoi programmé annulé pour le message {IdMess} : {Motif}", message.IdMess, motif);
                continue;
            }

            message.Statut = StatutMessage.Envoye;
            message.DateEnvoi = maintenant;
            message.DateModification = maintenant;
            message.DateEnvoiProgramme = null;
            envoyes++;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            if (envoyes > 0)
                _logger.LogInformation("Envoi programmé : {Nombre} message(s) envoyé(s).", envoyes);
        }
        catch (DbUpdateConcurrencyException)
        {
            // L'utilisateur a modifié ou envoyé le brouillon au même instant :
            // on réessaiera à la prochaine minute si la programmation existe encore.
            _logger.LogInformation("Envoi programmé : conflit de modification, nouvel essai à la prochaine exécution.");
        }
    }

    // Retourne null si le message peut partir, sinon la raison du blocage
    private static string? Valider(Message message, HashSet<string> utilisateursExistants)
    {
        if (string.IsNullOrWhiteSpace(message.Contenu))
            return "contenu vide";

        if (message.IdMessParent is null && string.IsNullOrWhiteSpace(message.Conversation.Objet))
            return "objet vide";

        var destinataires = message.Recepteurs.Select(r => r.Matricule).ToList();

        if (destinataires.Count == 0)
            return "aucun destinataire";

        if (destinataires.Any(d => !utilisateursExistants.Contains(d)))
            return "destinataire inconnu";

        return null;
    }
}
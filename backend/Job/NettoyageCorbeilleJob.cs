using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Quartz;

namespace backend.Jobs;

// Les messages restés trop longtemps dans la corbeille passent à l'état
// "Supprime" (masqués définitivement pour l'utilisateur concerné).
// [DisallowConcurrentExecution] : jamais deux exécutions en même temps.
[DisallowConcurrentExecution]
public class NettoyageCorbeilleJob : IJob
{
    private readonly AppDbContext _db;
    private readonly ILogger<NettoyageCorbeilleJob> _logger;

    // Quartz crée un scope DI par exécution : AppDbContext (scoped) s'injecte normalement
    public NettoyageCorbeilleJob(AppDbContext db, ILogger<NettoyageCorbeilleJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async ValueTask Execute(IJobExecutionContext context, CancellationToken cancellationToken)
    {
        var maintenant = DateTime.UtcNow;
        var limite = maintenant.AddDays(-CorbeilleParametres.JoursRetention);

        var nombre = await _db.MessagesUtilisateur
            .Where(s => s.Etat == EtatMessage.Corbeille && s.DateEtat < limite)
            .ExecuteUpdateAsync(set => set
                .SetProperty(s => s.Etat, EtatMessage.Supprime)
                .SetProperty(s => s.DateEtat, maintenant),
                cancellationToken);

        if (nombre > 0)
            _logger.LogInformation("Corbeille : {Nombre} message(s) supprimé(s) définitivement.", nombre);
    }
}
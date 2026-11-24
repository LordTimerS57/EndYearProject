using backend.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace backend.Services;

public class NotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public NotificationService(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifierNouveauMessage(
        IEnumerable<string> matriculesDestinataires,
        long idMess,
        long idConv,
        string objet,
        string expediteurNomComplet)
    {
        var payload = new
        {
            idMess,
            idConv,
            objet,
            expediteur = expediteurNomComplet,
            dateNotification = DateTime.UtcNow
        };

        // Envoi ciblé : SignalR associe automatiquement le matricule
        // au bon ConnectionId grâce au JWT (claim Sub).
        await _hubContext.Clients
            .Users(matriculesDestinataires.ToList())
            .SendAsync("NouveauMessageRecu", payload);
    }
}
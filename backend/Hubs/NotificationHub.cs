using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace backend.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    // Le Hub ne définit aucune méthode appelée par le client.
    // Il sert uniquement de point de connexion pour le serveur.
}
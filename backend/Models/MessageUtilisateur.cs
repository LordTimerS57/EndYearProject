namespace backend.Models;

public enum EtatMessage
{
    Archive = 1,
    Corbeille = 2,
    Supprime = 3   // définitif : masqué pour toujours pour cet utilisateur
}

public class MessageUtilisateur
{
    public long IdMess { get; set; }
    public string Matricule { get; set; } = string.Empty;
    public EtatMessage Etat { get; set; }
    public DateTime DateEtat { get; set; } = DateTime.UtcNow;
}
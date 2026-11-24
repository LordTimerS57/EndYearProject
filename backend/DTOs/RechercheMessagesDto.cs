namespace backend.DTOs;

public class RechercheMessagesDto
{
    public string? Q { get; set; }
    public string? Dossier { get; set; }      // boite | envoyes | archive | corbeille | brouillons
    public DateOnly? DateDebut { get; set; }
    public DateOnly? DateFin { get; set; }
    public int Page { get; set; } = 1;
    public int Taille { get; set; } = 25;
}
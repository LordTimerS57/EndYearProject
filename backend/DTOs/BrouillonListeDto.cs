namespace backend.DTOs;

public class BrouillonListeDto
{
    public long IdMess { get; set; }
    public long IdConv { get; set; }
    public string Objet { get; set; } = string.Empty;
    public string Apercu { get; set; } = string.Empty;
    public DateTime? DateModification { get; set; }   // nouveau champ (voir lot 3)
    public DateTime? DateCreation { get; set; }        // Conversation.DateCreation (info utile)
    public List<string> Destinataires { get; set; } = new();
    public int NombrePiecesJointes { get; set; }
}
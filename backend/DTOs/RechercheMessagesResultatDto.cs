namespace backend.DTOs;

public class RechercheMessagesResultatDto
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int Taille { get; set; }
    public List<MessageRechercheDto> Elements { get; set; } = new();
}

public class MessageRechercheDto
{
    public long IdMess { get; set; }
    public long IdConv { get; set; }
    public string Objet { get; set; } = string.Empty;
    public string Contenu { get; set; } = string.Empty;
    public DateTime? DateEnvoi { get; set; }
    public string Statut { get; set; } = string.Empty;
    public string MatriculeExpediteur { get; set; } = string.Empty;
    public string NomExpediteur { get; set; } = string.Empty;
    public string PrenomExpediteur { get; set; } = string.Empty;
    public List<BrouillonDestinataireDto> Destinataires { get; set; } = new();
    public string Dossier { get; set; } = string.Empty;   // pour que le front sache d'où vient le message
}
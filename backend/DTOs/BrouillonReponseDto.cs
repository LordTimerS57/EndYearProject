namespace backend.DTOs;

public class BrouillonReponseDto
{
    public long IdMess { get; set; }
    public long IdConv { get; set; }
    public string Statut { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
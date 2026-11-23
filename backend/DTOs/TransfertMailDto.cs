namespace backend.DTOs;

public class TransfertMailDto
{
    public List<string> MatriculesDestinataires { get; set; } = new();
    public string? Commentaire { get; set; }
}
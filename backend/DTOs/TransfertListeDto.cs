namespace backend.DTOs;

public class TransfertListeDto
{
    public long IdTransfert { get; set; }
    public long IdMessOriginal { get; set; }
    public long IdMessTransfere { get; set; }
    public string ObjetOriginal { get; set; } = string.Empty;
    public string ObjetTransfere { get; set; } = string.Empty;
    public DateTime DateTransfert { get; set; }
    public List<string> Destinataires { get; set; } = new();
}
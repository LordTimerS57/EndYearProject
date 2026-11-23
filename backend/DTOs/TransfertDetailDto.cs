namespace backend.DTOs;

public class TransfertDetailDto
{
    public long IdTransfert { get; set; }
    public long IdMessOriginal { get; set; }
    public long IdMessTransfere { get; set; }
    public long IdConvTransfere { get; set; }
    public string ObjetOriginal { get; set; } = string.Empty;
    public string ObjetTransfere { get; set; } = string.Empty;
    public string? Commentaire { get; set; }
    public string MatriculeTransmetteur { get; set; } = string.Empty;
    public DateTime DateTransfert { get; set; }
    public List<string> Destinataires { get; set; } = new();
    public List<PieceJointeDto> PiecesJointes { get; set; } = new();
}
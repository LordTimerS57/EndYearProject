
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class PieceJointe
{
    [Key]
    public long IdPiece { get; set; }

    public long IdMess { get; set; }
    public string NomFichier { get; set; } = string.Empty;
    public string BucketName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string TypeMime { get; set; } = string.Empty;
    public long TailleFichier { get; set; }
    public DateTime DateAjout { get; set; } = DateTime.UtcNow;

    public Message Message { get; set; } = null!;
}

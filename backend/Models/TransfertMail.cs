
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class TransfertMail
{
    [Key]
    public long IdTransfert { get; set; }

    public long IdMessOriginal { get; set; }
    public string MatriculeTransmetteur { get; set; } = string.Empty;
    public DateTime DateTransfert { get; set; } = DateTime.UtcNow;

    public Message MessageOriginal { get; set; } = null!;
    public Utilisateur Transmetteur { get; set; } = null!;
}

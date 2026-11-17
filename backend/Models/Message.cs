
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class Message
{
    [Key]
    public long IdMess { get; set; }

    public string Objet { get; set; } = string.Empty;
    public string Contenu { get; set; } = string.Empty;
    public DateTime? DateEnvoi { get; set; }
    public string Statut { get; set; } = "Brouillon";

    public string MatriculeExpediteur { get; set; } = string.Empty;

    public Utilisateur Expediteur { get; set; } = null!;
}

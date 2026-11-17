
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class Recepteur
{
    [Key]
    public long IdRecep { get; set; }

    public string Matricule { get; set; } = string.Empty;
    public long IdMess { get; set; }

    public Utilisateur Utilisateur { get; set; } = null!;
    public Message Message { get; set; } = null!;
}

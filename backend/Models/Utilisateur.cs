
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class Utilisateur
{
    [Key]
    public string Matricule { get; set; } = string.Empty;

    public string Nom { get; set; } = string.Empty;
    public string Prenom { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string MotDePasseHash { get; set; } = string.Empty;
    public string Fonction { get; set; } = string.Empty;
    public string Statut { get; set; } = "Actif";
    public DateTime DateCreation { get; set; } = DateTime.UtcNow;
}

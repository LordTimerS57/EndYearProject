
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class InscriptionDto
{
    [Required]
    [StringLength(30)]
    public string Matricule { get; set; } = string.Empty;

    [Required]
    public string Nom { get; set; } = string.Empty;

    [Required]
    public string Prenom { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Fonction { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string MotDePasse { get; set; } = string.Empty;
}

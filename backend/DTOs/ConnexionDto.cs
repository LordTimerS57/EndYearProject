
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class ConnexionDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string MotDePasse { get; set; } = string.Empty;
}

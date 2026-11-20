
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class EnvoyerMessageDto
{
    public string Contenu { get; set; } = string.Empty;
    public string? Objet { get; set; } // Obligatoire si nouveau message
    public long? IdMessParent { get; set; } // Remplir si c'est une réponse
    public List<string> MatriculesDestinataires { get; set; } = new();
}

namespace backend.DTOs;

public class BrouillonDto
{
    public string? Objet { get; set; }

    public string? Contenu { get; set; }

    public List<string>? MatriculesDestinataires { get; set; }

    // Pour une éventuelle réponse à un message existant
    public long? IdMessParent { get; set; }
}

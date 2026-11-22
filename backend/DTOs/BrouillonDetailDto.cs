namespace backend.DTOs;

public class BrouillonDetailDto
{
    public long IdMess { get; set; }
    public long IdConv { get; set; }
    public string Objet { get; set; } = string.Empty;
    public string Contenu { get; set; } = string.Empty;
    public List<string> MatriculesDestinataires { get; set; } = new();
    public long? IdMessParent { get; set; }
    public List<PieceJointeDto> PiecesJointes { get; set; } = new();
}

public class PieceJointeDto
{
    public long IdPiece { get; set; }       
    public string NomFichier { get; set; } = string.Empty;
    public string TypeMime { get; set; } = string.Empty;
    public long TailleFichier { get; set; }
    public DateTime DateAjout { get; set; }
}
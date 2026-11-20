
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class TransfererMessageDto
{
	public long IdMessOriginal { get; set; }
	public List<string> MatriculesDestinataires { get; set; } = new();
}
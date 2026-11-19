
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class Conversation
{
    [Key]
    public long IdConv { get; set; }

    public string Objet { get; set; } = string.Empty;
    public DateTime DateCreation { get; set; }

    public ICollection<Message> Messages { get; set; } = new List<Message>();

}

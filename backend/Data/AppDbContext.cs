
using Microsoft.EntityFrameworkCore;
using backend.Models;

namespace backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Utilisateur> Utilisateurs => Set<Utilisateur>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Recepteur> Recepteurs => Set<Recepteur>();
    public DbSet<PieceJointe> PiecesJointes => Set<PieceJointe>();
    public DbSet<TransfertMail> TransfertsMail => Set<TransfertMail>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<MessageUtilisateur> MessagesUtilisateur { get; set; }



    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Utilisateur -> Message
        modelBuilder.Entity<Message>()
            .HasOne(m => m.MessageParent)
            .WithMany(m => m.Reponses)
            .HasForeignKey(m => m.IdMessParent)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.IdConv);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Expediteur)
            .WithMany()                      
            .HasForeignKey(m => m.MatriculeExpediteur)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasMany(m => m.Recepteurs)
            .WithOne(r => r.Message)
            .HasForeignKey(r => r.IdMess)
            .OnDelete(DeleteBehavior.Cascade);

        // Utilisateur -> Recepteur
        modelBuilder.Entity<Recepteur>()
            .HasOne(r => r.Utilisateur)
            .WithMany()
            .HasForeignKey(r => r.Matricule)
            .OnDelete(DeleteBehavior.Restrict);

        // Message -> PieceJointe
        modelBuilder.Entity<PieceJointe>()
            .HasOne(p => p.Message)
            .WithMany(m => m.PiecesJointes)
            .HasForeignKey(p => p.IdMess)
            .OnDelete(DeleteBehavior.Cascade);

        // Message -> TransfertMail
        modelBuilder.Entity<TransfertMail>()
            .HasOne(t => t.MessageOriginal)
            .WithMany()
            .HasForeignKey(t => t.IdMessOriginal)
            .OnDelete(DeleteBehavior.Restrict);

        // Utilisateur -> TransfertMail
        modelBuilder.Entity<TransfertMail>()
            .HasOne(t => t.Transmetteur)
            .WithMany()
            .HasForeignKey(t => t.MatriculeTransmetteur)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransfertMail>()
            .HasOne(t => t.MessageTransfere)
            .WithMany()
            .HasForeignKey(t => t.IdMessTransfere)
            .OnDelete(DeleteBehavior.Restrict);

        // Email unique
        modelBuilder.Entity<Utilisateur>()
            .HasIndex(u => u.Email)
            .IsUnique();


        modelBuilder.Entity<Recepteur>()
            .HasIndex(r => new { r.IdMess, r.Matricule })
            .IsUnique();

        modelBuilder.Entity<Recepteur>()
            .HasOne(r => r.Message).WithMany(m => m.Recepteurs)
            .HasForeignKey(r => r.IdMess).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MessageUtilisateur>(e =>
        {
            e.HasKey(s => new { s.IdMess, s.Matricule });
            e.HasIndex(s => new { s.Matricule, s.Etat });   // accélère les listes par dossier

            e.HasOne<Message>().WithMany()
                .HasForeignKey(s => s.IdMess)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne<Utilisateur>().WithMany()
                .HasForeignKey(s => s.Matricule)
                .OnDelete(DeleteBehavior.Cascade);
        });

    }
}

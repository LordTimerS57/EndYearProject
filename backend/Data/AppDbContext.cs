
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


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Utilisateur -> Message
        modelBuilder.Entity<Message>()
            .HasOne(m => m.Expediteur)
            .WithMany()
            .HasForeignKey(m => m.MatriculeExpediteur)
            .OnDelete(DeleteBehavior.Restrict);

        // Utilisateur -> Recepteur
        modelBuilder.Entity<Recepteur>()
            .HasOne(r => r.Utilisateur)
            .WithMany()
            .HasForeignKey(r => r.Matricule)
            .OnDelete(DeleteBehavior.Restrict);

        // Message -> Recepteur
        modelBuilder.Entity<Recepteur>()
            .HasOne(r => r.Message)
            .WithMany()
            .HasForeignKey(r => r.IdMess)
            .OnDelete(DeleteBehavior.Cascade);

        // Message -> PieceJointe
        modelBuilder.Entity<PieceJointe>()
            .HasOne(p => p.Message)
            .WithMany()
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

        // Email unique
        modelBuilder.Entity<Utilisateur>()
            .HasIndex(u => u.Email)
            .IsUnique();


        modelBuilder.Entity<Recepteur>()
            .HasIndex(r => new { r.IdMess, r.Matricule })
            .IsUnique();
    }
}

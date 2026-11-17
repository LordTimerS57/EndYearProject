
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PasswordHasher<Utilisateur> _passwordHasher;

    public AuthController(AppDbContext context)
    {
        _context = context;
        _passwordHasher = new PasswordHasher<Utilisateur>();
    }

    [HttpPost("inscription")]
    public async Task<IActionResult> Inscription(
        [FromBody] InscriptionDto dto)
    {
        var matricule = dto.Matricule.Trim();
        var email = dto.Email.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(matricule) ||
            string.IsNullOrWhiteSpace(dto.Nom) ||
            string.IsNullOrWhiteSpace(dto.Prenom) ||
            string.IsNullOrWhiteSpace(dto.Fonction))
        {
            return BadRequest(new
            {
                message = "Les champs obligatoires ne peuvent pas être vides."
            });
        }

        var existe = await _context.Utilisateurs
            .AnyAsync(u =>
                u.Matricule == matricule ||
                u.Email == email);

        if (existe)
        {
            return Conflict(new
            {
                message = "Ce matricule ou cet email existe déjà."
            });
        }

        var utilisateur = new Utilisateur
        {
            Matricule = matricule,
            Nom = dto.Nom.Trim(),
            Prenom = dto.Prenom.Trim(),
            Email = email,
            Fonction = dto.Fonction.Trim(),
            Type = "Utilisateur",
            Statut = "En attente",
            DateCreation = DateTime.UtcNow
        };

        utilisateur.MotDePasseHash =
            _passwordHasher.HashPassword(
                utilisateur,
                dto.MotDePasse
            );

        _context.Utilisateurs.Add(utilisateur);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new
            {
                message = "Impossible de créer le compte. Vérifiez le matricule et l'email."
            });
        }

        return StatusCode(201, new
        {
            message = "Inscription réussie. En attente de validation par l'administrateur.",
            matricule = utilisateur.Matricule,
            statut = utilisateur.Statut
        });
    }
}

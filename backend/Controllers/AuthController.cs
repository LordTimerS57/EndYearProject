
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher<Utilisateur> _passwordHasher;

    public AuthController(
        AppDbContext context,
        IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
        _passwordHasher = new PasswordHasher<Utilisateur>();
    }

    // INSCRIPTION
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
                message = "Tous les champs sont obligatoires."
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
            message = "Inscription réussie. Votre compte est en attente de validation par l'administrateur.",
            matricule = utilisateur.Matricule,
            statut = utilisateur.Statut
        });
    }

    // CONNEXION

    [HttpPost("connexion")]
    public async Task<IActionResult> Connexion(
        [FromBody] ConnexionDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();

        var utilisateur = await _context.Utilisateurs
            .FirstOrDefaultAsync(u => u.Email == email);

        if (utilisateur == null)
        {
            return Unauthorized(new
            {
                message = "Email ou mot de passe incorrect."
            });
        }

        var verification =
            _passwordHasher.VerifyHashedPassword(
                utilisateur,
                utilisateur.MotDePasseHash,
                dto.MotDePasse
            );

        if (verification == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new
            {
                message = "Email ou mot de passe incorrect."
            });
        }

        if (utilisateur.Statut != "Actif")
        {
            return StatusCode(403, new
            {
                message = utilisateur.Statut switch
                {
                    "En attente" =>
                        "Votre compte est en attente de validation par l'administrateur.",

                    "Refusé" =>
                        "Votre demande d'inscription a été refusée.",

                    _ =>
                        "Votre compte est désactivé."
                },
                statut = utilisateur.Statut
            });
        }

        var jwtKey = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "Clé JWT non configurée.");

        var jwtIssuer = _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException(
                "Issuer JWT non configuré.");

        var jwtAudience = _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException(
                "Audience JWT non configurée.");

        var claims = new List<Claim>
        {
            new Claim(
                JwtRegisteredClaimNames.Sub,
                utilisateur.Matricule
            ),

            new Claim(
                JwtRegisteredClaimNames.Jti,
                Guid.NewGuid().ToString()
            ),

            new Claim("role", utilisateur.Type)
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey)
        );

        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256
        );

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: credentials
        );

        var tokenString =
            new JwtSecurityTokenHandler().WriteToken(token);

        return Ok(new
        {
            message = "Connexion réussie.",
            token = tokenString,
            tokenType = "Bearer",
            expiresIn = 7200,

            utilisateur = new
            {
                utilisateur.Matricule,
                utilisateur.Nom,
                utilisateur.Prenom,
                utilisateur.Email,
                utilisateur.Fonction,
                utilisateur.Type,
                utilisateur.Statut
            }
        });
    }
}

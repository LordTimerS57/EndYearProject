
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Administrateur")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
private readonly IEmailService _emailService;
private readonly ILogger<AdminController> _logger;

public AdminController(
    AppDbContext context,
    IEmailService emailService,
    ILogger<AdminController> logger)
{
    _context = context;
    _emailService = emailService;
    _logger = logger;
}

    //en-attente
    [HttpGet("utilisateurs/en-attente")]
    public async Task<IActionResult> UtilisateursEnAttente()
    {
        var utilisateurs = await _context.Utilisateurs
            .AsNoTracking()
            .Where(u => u.Statut == "En attente")
            .OrderBy(u => u.DateCreation)
            .Select(u => new
            {
                u.Matricule,
                u.Nom,
                u.Prenom,
                u.Email,
                u.Fonction,
                u.Type,
                u.Statut,
                u.DateCreation
            })
            .ToListAsync();

        return Ok(utilisateurs);
    }

    [HttpGet("statistiques")]
public async Task<IActionResult> GetStatistiques(
    CancellationToken cancellationToken)
{
    var statuts = await _context.Utilisateurs
        .GroupBy(u => u.Statut)
        .Select(g => new
        {
            Statut = g.Key,
            Nombre = g.Count()
        })
        .ToListAsync(cancellationToken);

    var total = statuts.Sum(s => s.Nombre);

    var actifs = statuts
        .Where(s => s.Statut == "Actif")
        .Sum(s => s.Nombre);

    var supprimes = statuts
        .Where(s => s.Statut == "Supprimé")
        .Sum(s => s.Nombre);

    var enAttente = statuts
        .Where(s => s.Statut == "En attente")
        .Sum(s => s.Nombre);

    return Ok(new
    {
        total,
        supprimes,
        actifs,
        enAttente
    });
}

    //utilisateurs
    [HttpGet("utilisateurs")]
    public async Task<IActionResult> TousLesUtilisateurs()
    {
        var utilisateurs = await _context.Utilisateurs
            .AsNoTracking()
            .OrderByDescending(u => u.DateCreation)
            .Select(u => new
            {
                u.Matricule,
                u.Nom,
                u.Prenom,
                u.Email,
                u.Fonction,
                u.Type,
                u.Statut,
                u.DateCreation
            })
            .ToListAsync();

        return Ok(utilisateurs);
    }

    //valider
    [HttpPatch("utilisateurs/{matricule}/valider")]
    public async Task<IActionResult> Valider(string matricule)
    {
        var utilisateur = await _context.Utilisateurs
            .FirstOrDefaultAsync(u => u.Matricule == matricule);

        if (utilisateur == null)
        {
            return NotFound(new
            {
                message = "Utilisateur introuvable."
            });
        }

        if (utilisateur.Statut != "En attente")
        {
            return Conflict(new
            {
                message = "Ce compte n'est pas en attente de validation."
            });
        }

        utilisateur.Statut = "Actif";
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Compte validé avec succès.",
            matricule = utilisateur.Matricule,
            statut = utilisateur.Statut
        });
    }

   //Refuser 
[HttpPatch("utilisateurs/{matricule}/refuser")]
public async Task<IActionResult> Refuser(
    string matricule,
    CancellationToken cancellationToken)
{
    var utilisateur = await _context.Utilisateurs
        .FirstOrDefaultAsync(
            u => u.Matricule == matricule,
            cancellationToken
        );

    if (utilisateur == null)
    {
        return NotFound(new
        {
            message = "Utilisateur introuvable."
        });
    }

    if (utilisateur.Statut != "En attente")
    {
        return Conflict(new
        {
            message = "Ce compte n'est pas en attente de validation."
        });
    }

    utilisateur.Statut = "Refusé";

    await _context.SaveChangesAsync(
        cancellationToken
    );

    try
    {
        await _emailService.EnvoyerRefusInscriptionAsync(
            utilisateur.Email,
            utilisateur.Prenom,
            utilisateur.Nom,
            cancellationToken
        );

        return Ok(new
        {
            message = "Inscription refusée. Email de notification envoyé.",
            matricule = utilisateur.Matricule,
            statut = utilisateur.Statut,
            emailEnvoye = true
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(
            ex,
            "Échec de notification du refus pour {Matricule}",
            utilisateur.Matricule
        );

        // Le refus reste enregistré même si Gmail échoue.
        return Ok(new
        {
            message = "Inscription refusée, mais l'envoi de l'email a échoué.",
            matricule = utilisateur.Matricule,
            statut = utilisateur.Statut,
            emailEnvoye = false
        });
    }
}
}


namespace backend.Services;

public class FileStorageService
{
    private readonly string _cheminBase;

    public FileStorageService(IConfiguration configuration)
    {
        _cheminBase = configuration["Stockage:CheminFichiers"]
            ?? throw new InvalidOperationException("Le chemin de stockage n'est pas configuré.");

        if (!Directory.Exists(_cheminBase))
        {
            Directory.CreateDirectory(_cheminBase);
        }
    }

    public async Task<string> SauvegarderFichierAsync(IFormFile fichier)
    {
        // Générer un nom unique pour éviter les conflits (ex: 8f4b2a1c-..._.pdf)
        var nomUnique = $"{Guid.NewGuid()}_{Path.GetFileName(fichier.FileName)}";

        // Créer un sous-dossier par mois/année pour éviter d'avoir 100 000 fichiers dans un seul dossier
        var sousDossier = DateTime.UtcNow.ToString("yyyy-MM");
        var dossierComplet = Path.Combine(_cheminBase, sousDossier);

        if (!Directory.Exists(dossierComplet))
        {
            Directory.CreateDirectory(dossierComplet);
        }

        var cheminComplet = Path.Combine(dossierComplet, nomUnique);

        using (var stream = new FileStream(cheminComplet, FileMode.Create))
        {
            await fichier.CopyToAsync(stream);
        }

        // On retourne le chemin relatif (ex: "2024-05/8f4b2a1c_facture.pdf")
        return Path.Combine(sousDossier, nomUnique).Replace("\\", "/");
    }

    public void SupprimerFichier(string cheminRelatif)
    {
        var cheminComplet = Path.Combine(_cheminBase, cheminRelatif);
        if (File.Exists(cheminComplet))
        {
            File.Delete(cheminComplet);
        }
    }

    public Task SupprimerFichierAsync(string cheminRelatif, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(cheminRelatif))
            return Task.CompletedTask;

        var cheminComplet = Path.Combine(_cheminBase, cheminRelatif);
        if (File.Exists(cheminComplet))
            File.Delete(cheminComplet);

        return Task.CompletedTask;
    }
}
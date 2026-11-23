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


    /// <summary>
    /// Copie un fichier existant vers un nouvel emplacement indépendant.
    /// Retourne le chemin RELATIF du nouveau fichier (ex: "2024-05/abc_def.pdf").
    /// Le fichier source n'est jamais modifié ni supprimé.
    /// </summary>
    public async Task<string> CopierFichierAsync(string cheminRelatifSource, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(cheminRelatifSource))
            throw new ArgumentException("Chemin source vide.", nameof(cheminRelatifSource));

        // Le cheminRelatifSource peut contenir des "/" (SauvegarderFichierAsync les produit)
        var source = Path.Combine(_cheminBase, cheminRelatifSource);
        if (!File.Exists(source))
            throw new FileNotFoundException("Fichier source introuvable.", source);

        // Même convention que SauvegarderFichierAsync : sous-dossier yyyy-MM + GUID_NomOriginal
        var sousDossier = DateTime.UtcNow.ToString("yyyy-MM");
        var dossierComplet = Path.Combine(_cheminBase, sousDossier);
        if (!Directory.Exists(dossierComplet))
            Directory.CreateDirectory(dossierComplet);

        var nomOriginal = Path.GetFileName(cheminRelatifSource); // ex: "abc_original.pdf"
        var nomUnique = $"{Guid.NewGuid()}_{nomOriginal}";
        var destination = Path.Combine(dossierComplet, nomUnique);

        await using (var src = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read))
        await using (var dst = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await src.CopyToAsync(dst, ct);
        }

        return Path.Combine(sousDossier, nomUnique).Replace("\\", "/");
    }
}
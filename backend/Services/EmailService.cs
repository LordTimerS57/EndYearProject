
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace backend.Services;

public interface IEmailService
{
    Task EnvoyerRefusInscriptionAsync(
        string email,
        string prenom,
        string nom,
        CancellationToken cancellationToken = default
    );
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task EnvoyerRefusInscriptionAsync(
        string email,
        string prenom,
        string nom,
        CancellationToken cancellationToken = default)
    {
        var host = _configuration["Smtp:Host"]
            ?? throw new InvalidOperationException(
                "Serveur SMTP non configuré.");

        var port = int.Parse(
            _configuration["Smtp:Port"] ?? "587");

        var username = _configuration["Smtp:Username"]
            ?? throw new InvalidOperationException(
                "Identifiant SMTP non configuré.");

        var password = _configuration["Smtp:Password"]
            ?? throw new InvalidOperationException(
                "Mot de passe SMTP non configuré.");

        var fromName =
            _configuration["Smtp:FromName"]
            ?? "Messagerie Interne";

        var message = new MimeMessage();

        message.From.Add(
            new MailboxAddress(fromName, username)
        );

        message.To.Add(
            MailboxAddress.Parse(email)
        );

        message.Subject =
            "Décision concernant votre inscription";

        message.Body = new TextPart("plain")
        {
            Text = $"""
            Bonjour {prenom} {nom},

            Nous vous informons que votre demande
            d'inscription à notre plateforme de
            messagerie interne n'a pas été acceptée.

            Votre compte ne peut donc pas être utilisé
            pour accéder à la plateforme.

            Cordialement,

            L'équipe d'administration
            Messagerie Interne
            """
        };

        using var client = new SmtpClient();

        client.Timeout = 15000;

        await client.ConnectAsync(
            host,
            port,
            SecureSocketOptions.StartTls,
            cancellationToken
        );

        await client.AuthenticateAsync(
            username,
            password,
            cancellationToken
        );

        await client.SendAsync(
            message,
            cancellationToken
        );

        await client.DisconnectAsync(
            true,
            cancellationToken
        );
    }
}

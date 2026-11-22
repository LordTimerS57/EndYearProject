
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using backend.Data;
using Microsoft.AspNetCore.Routing;
using backend.Services;
using backend.Jobs;
using Quartz;


var builder = WebApplication.CreateBuilder(args);

// Configuration PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
);

// Services
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Configuration JWT
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Clé JWT non configurée.");

var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException(
        "Issuer JWT non configuré.");

var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException(
        "Audience JWT non configurée.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtKey)
                    ),

                ClockSkew = TimeSpan.Zero,
                RoleClaimType = "role",
                NameClaimType = "sub"
            };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<FileStorageService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Service de notification email
builder.Services.AddScoped<IEmailService, EmailService>();

builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("NettoyageCorbeilleJob");

    q.AddJob<NettoyageCorbeilleJob>(options =>
        options.WithIdentity(jobKey));

    q.AddTrigger(options => options
        .ForJob(jobKey)
        .WithIdentity("NettoyageCorbeilleTrigger")
        .WithSimpleSchedule(schedule => schedule
            .WithInterval(TimeSpan.FromHours(24))
            .RepeatForever()
        )
    );
});

builder.Services.AddQuartzHostedService(o => o.WaitForJobsToComplete = true);

var app = builder.Build();

// Vérification OpenAPI
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("ReactFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Vérification PostgreSQL
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();

    var db = scope.ServiceProvider
        .GetRequiredService<AppDbContext>();

    var connected = await db.Database.CanConnectAsync();

    Console.WriteLine(
        connected
            ? "Connexion PostgreSQL réussie !"
            : "Échec de connexion PostgreSQL."
    );
}

app.MapGet("/debug/routes", (
    IEnumerable<EndpointDataSource> sources) =>
{
    return sources
        .SelectMany(source => source.Endpoints)
        .Select(endpoint => endpoint.DisplayName)
        .ToList();
});

//backend
app.MapGet("/test", () => "BACKEND MESSAGERIE OK");


app.Run();

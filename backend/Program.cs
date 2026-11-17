
using Microsoft.EntityFrameworkCore;
using backend.Data;

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

var app = builder.Build();

// Vérification OpenAPI
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();


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


app.Run();

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class MessageUtilisateurEtat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MessagesUtilisateur",
                columns: table => new
                {
                    IdMess = table.Column<long>(type: "bigint", nullable: false),
                    Matricule = table.Column<string>(type: "text", nullable: false),
                    Etat = table.Column<int>(type: "integer", nullable: false),
                    DateEtat = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessagesUtilisateur", x => new { x.IdMess, x.Matricule });
                    table.ForeignKey(
                        name: "FK_MessagesUtilisateur_Messages_IdMess",
                        column: x => x.IdMess,
                        principalTable: "Messages",
                        principalColumn: "IdMess",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MessagesUtilisateur_Utilisateurs_Matricule",
                        column: x => x.Matricule,
                        principalTable: "Utilisateurs",
                        principalColumn: "Matricule",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MessagesUtilisateur_Matricule_Etat",
                table: "MessagesUtilisateur",
                columns: new[] { "Matricule", "Etat" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MessagesUtilisateur");
        }
    }
}

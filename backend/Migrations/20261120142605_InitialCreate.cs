using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Conversations",
                columns: table => new
                {
                    IdConv = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Objet = table.Column<string>(type: "text", nullable: false),
                    DateCreation = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conversations", x => x.IdConv);
                });

            migrationBuilder.CreateTable(
                name: "Utilisateurs",
                columns: table => new
                {
                    Matricule = table.Column<string>(type: "text", nullable: false),
                    Nom = table.Column<string>(type: "text", nullable: false),
                    Prenom = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    MotDePasseHash = table.Column<string>(type: "text", nullable: false),
                    Fonction = table.Column<string>(type: "text", nullable: false),
                    Statut = table.Column<string>(type: "text", nullable: false),
                    DateCreation = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Utilisateurs", x => x.Matricule);
                });

            migrationBuilder.CreateTable(
                name: "Messages",
                columns: table => new
                {
                    IdMess = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Contenu = table.Column<string>(type: "text", nullable: false),
                    DateEnvoi = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Statut = table.Column<string>(type: "text", nullable: false),
                    MatriculeExpediteur = table.Column<string>(type: "text", nullable: false),
                    ExpediteurMatricule = table.Column<string>(type: "text", nullable: false),
                    IdConv = table.Column<long>(type: "bigint", nullable: false),
                    IdMessParent = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Messages", x => x.IdMess);
                    table.ForeignKey(
                        name: "FK_Messages_Conversations_IdConv",
                        column: x => x.IdConv,
                        principalTable: "Conversations",
                        principalColumn: "IdConv",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Messages_Messages_IdMessParent",
                        column: x => x.IdMessParent,
                        principalTable: "Messages",
                        principalColumn: "IdMess",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Messages_Utilisateurs_ExpediteurMatricule",
                        column: x => x.ExpediteurMatricule,
                        principalTable: "Utilisateurs",
                        principalColumn: "Matricule",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PiecesJointes",
                columns: table => new
                {
                    IdPiece = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IdMess = table.Column<long>(type: "bigint", nullable: false),
                    NomFichier = table.Column<string>(type: "text", nullable: false),
                    CheminFichier = table.Column<string>(type: "text", nullable: false),
                    ObjectKey = table.Column<string>(type: "text", nullable: false),
                    TypeMime = table.Column<string>(type: "text", nullable: false),
                    TailleFichier = table.Column<long>(type: "bigint", nullable: false),
                    DateAjout = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MessageIdMess = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PiecesJointes", x => x.IdPiece);
                    table.ForeignKey(
                        name: "FK_PiecesJointes_Messages_IdMess",
                        column: x => x.IdMess,
                        principalTable: "Messages",
                        principalColumn: "IdMess",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PiecesJointes_Messages_MessageIdMess",
                        column: x => x.MessageIdMess,
                        principalTable: "Messages",
                        principalColumn: "IdMess");
                });

            migrationBuilder.CreateTable(
                name: "Recepteurs",
                columns: table => new
                {
                    IdRecep = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Matricule = table.Column<string>(type: "text", nullable: false),
                    IdMess = table.Column<long>(type: "bigint", nullable: false),
                    MessageIdMess = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recepteurs", x => x.IdRecep);
                    table.ForeignKey(
                        name: "FK_Recepteurs_Messages_IdMess",
                        column: x => x.IdMess,
                        principalTable: "Messages",
                        principalColumn: "IdMess",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Recepteurs_Messages_MessageIdMess",
                        column: x => x.MessageIdMess,
                        principalTable: "Messages",
                        principalColumn: "IdMess");
                    table.ForeignKey(
                        name: "FK_Recepteurs_Utilisateurs_Matricule",
                        column: x => x.Matricule,
                        principalTable: "Utilisateurs",
                        principalColumn: "Matricule",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TransfertsMail",
                columns: table => new
                {
                    IdTransfert = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IdMessOriginal = table.Column<long>(type: "bigint", nullable: false),
                    MatriculeTransmetteur = table.Column<string>(type: "text", nullable: false),
                    DateTransfert = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransfertsMail", x => x.IdTransfert);
                    table.ForeignKey(
                        name: "FK_TransfertsMail_Messages_IdMessOriginal",
                        column: x => x.IdMessOriginal,
                        principalTable: "Messages",
                        principalColumn: "IdMess",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TransfertsMail_Utilisateurs_MatriculeTransmetteur",
                        column: x => x.MatriculeTransmetteur,
                        principalTable: "Utilisateurs",
                        principalColumn: "Matricule",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ExpediteurMatricule",
                table: "Messages",
                column: "ExpediteurMatricule");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_IdConv",
                table: "Messages",
                column: "IdConv");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_IdMessParent",
                table: "Messages",
                column: "IdMessParent");

            migrationBuilder.CreateIndex(
                name: "IX_PiecesJointes_IdMess",
                table: "PiecesJointes",
                column: "IdMess");

            migrationBuilder.CreateIndex(
                name: "IX_PiecesJointes_MessageIdMess",
                table: "PiecesJointes",
                column: "MessageIdMess");

            migrationBuilder.CreateIndex(
                name: "IX_Recepteurs_IdMess_Matricule",
                table: "Recepteurs",
                columns: new[] { "IdMess", "Matricule" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Recepteurs_Matricule",
                table: "Recepteurs",
                column: "Matricule");

            migrationBuilder.CreateIndex(
                name: "IX_Recepteurs_MessageIdMess",
                table: "Recepteurs",
                column: "MessageIdMess");

            migrationBuilder.CreateIndex(
                name: "IX_TransfertsMail_IdMessOriginal",
                table: "TransfertsMail",
                column: "IdMessOriginal");

            migrationBuilder.CreateIndex(
                name: "IX_TransfertsMail_MatriculeTransmetteur",
                table: "TransfertsMail",
                column: "MatriculeTransmetteur");

            migrationBuilder.CreateIndex(
                name: "IX_Utilisateurs_Email",
                table: "Utilisateurs",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PiecesJointes");

            migrationBuilder.DropTable(
                name: "Recepteurs");

            migrationBuilder.DropTable(
                name: "TransfertsMail");

            migrationBuilder.DropTable(
                name: "Messages");

            migrationBuilder.DropTable(
                name: "Conversations");

            migrationBuilder.DropTable(
                name: "Utilisateurs");
        }
    }
}

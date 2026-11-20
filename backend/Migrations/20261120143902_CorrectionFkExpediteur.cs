using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class CorrectionFkExpediteur : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Utilisateurs_ExpediteurMatricule",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ExpediteurMatricule",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ExpediteurMatricule",
                table: "Messages");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_MatriculeExpediteur",
                table: "Messages",
                column: "MatriculeExpediteur");

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Utilisateurs_MatriculeExpediteur",
                table: "Messages",
                column: "MatriculeExpediteur",
                principalTable: "Utilisateurs",
                principalColumn: "Matricule",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Utilisateurs_MatriculeExpediteur",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_MatriculeExpediteur",
                table: "Messages");

            migrationBuilder.AddColumn<string>(
                name: "ExpediteurMatricule",
                table: "Messages",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ExpediteurMatricule",
                table: "Messages",
                column: "ExpediteurMatricule");

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Utilisateurs_ExpediteurMatricule",
                table: "Messages",
                column: "ExpediteurMatricule",
                principalTable: "Utilisateurs",
                principalColumn: "Matricule",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

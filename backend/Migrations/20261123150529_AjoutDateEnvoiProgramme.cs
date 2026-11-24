using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AjoutDateEnvoiProgramme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateEnvoiProgramme",
                table: "Messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_Statut_DateEnvoiProgramme",
                table: "Messages",
                columns: new[] { "Statut", "DateEnvoiProgramme" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_Statut_DateEnvoiProgramme",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "DateEnvoiProgramme",
                table: "Messages");
        }
    }
}

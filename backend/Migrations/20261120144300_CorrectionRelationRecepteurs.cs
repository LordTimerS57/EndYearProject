using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class CorrectionRelationRecepteurs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Recepteurs_Messages_MessageIdMess",
                table: "Recepteurs");

            migrationBuilder.DropIndex(
                name: "IX_Recepteurs_MessageIdMess",
                table: "Recepteurs");

            migrationBuilder.DropColumn(
                name: "MessageIdMess",
                table: "Recepteurs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "MessageIdMess",
                table: "Recepteurs",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Recepteurs_MessageIdMess",
                table: "Recepteurs",
                column: "MessageIdMess");

            migrationBuilder.AddForeignKey(
                name: "FK_Recepteurs_Messages_MessageIdMess",
                table: "Recepteurs",
                column: "MessageIdMess",
                principalTable: "Messages",
                principalColumn: "IdMess");
        }
    }
}

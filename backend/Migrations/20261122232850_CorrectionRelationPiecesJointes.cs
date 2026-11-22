using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class CorrectionRelationPiecesJointes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PiecesJointes_Messages_MessageIdMess",
                table: "PiecesJointes");

            migrationBuilder.DropIndex(
                name: "IX_PiecesJointes_MessageIdMess",
                table: "PiecesJointes");

            migrationBuilder.DropColumn(
                name: "MessageIdMess",
                table: "PiecesJointes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "MessageIdMess",
                table: "PiecesJointes",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PiecesJointes_MessageIdMess",
                table: "PiecesJointes",
                column: "MessageIdMess");

            migrationBuilder.AddForeignKey(
                name: "FK_PiecesJointes_Messages_MessageIdMess",
                table: "PiecesJointes",
                column: "MessageIdMess",
                principalTable: "Messages",
                principalColumn: "IdMess");
        }
    }
}

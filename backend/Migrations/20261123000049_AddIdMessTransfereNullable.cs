using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddIdMessTransfereNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "IdMessTransfere",
                table: "TransfertsMail",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransfertsMail_IdMessTransfere",
                table: "TransfertsMail",
                column: "IdMessTransfere");

            migrationBuilder.AddForeignKey(
                name: "FK_TransfertsMail_Messages_IdMessTransfere",
                table: "TransfertsMail",
                column: "IdMessTransfere",
                principalTable: "Messages",
                principalColumn: "IdMess",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TransfertsMail_Messages_IdMessTransfere",
                table: "TransfertsMail");

            migrationBuilder.DropIndex(
                name: "IX_TransfertsMail_IdMessTransfere",
                table: "TransfertsMail");

            migrationBuilder.DropColumn(
                name: "IdMessTransfere",
                table: "TransfertsMail");
        }
    }
}

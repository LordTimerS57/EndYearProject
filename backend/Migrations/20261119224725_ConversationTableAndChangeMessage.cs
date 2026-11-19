using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ConversationTableAndChangeMessage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Objet",
                table: "Messages");

            migrationBuilder.AddColumn<long>(
                name: "ConversationIdConv",
                table: "Messages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "IdConv",
                table: "Messages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "IdMessParent",
                table: "Messages",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "MessageParentIdMess",
                table: "Messages",
                type: "bigint",
                nullable: true);

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

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationIdConv",
                table: "Messages",
                column: "ConversationIdConv");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_MessageParentIdMess",
                table: "Messages",
                column: "MessageParentIdMess");

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Conversations_ConversationIdConv",
                table: "Messages",
                column: "ConversationIdConv",
                principalTable: "Conversations",
                principalColumn: "IdConv",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Messages_MessageParentIdMess",
                table: "Messages",
                column: "MessageParentIdMess",
                principalTable: "Messages",
                principalColumn: "IdMess");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Conversations_ConversationIdConv",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Messages_MessageParentIdMess",
                table: "Messages");

            migrationBuilder.DropTable(
                name: "Conversations");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationIdConv",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_MessageParentIdMess",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ConversationIdConv",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "IdConv",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "IdMessParent",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "MessageParentIdMess",
                table: "Messages");

            migrationBuilder.AddColumn<string>(
                name: "Objet",
                table: "Messages",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}

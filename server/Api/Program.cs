using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuizesApi.Models;
using QuizesApi.Repositories;
using QuizesApi.Repositories.Interfaces;
using QuizesApi.Repositories.Implementation;
using System;
using System.Text;

namespace QuizesApi
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container BEFORE building the app
            builder.Services.AddControllers()
                .AddJsonOptions(options => {
                    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                    options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                });

            // Swagger/OpenAPI
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            // Database context
            // Database context
            builder.Services.AddDbContext<ElsewedySchoolSysDbDevContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
                
            // Add Memory Cache for performance
            builder.Services.AddMemoryCache();
                
               


            // Remove ASP.NET Identity; authenticate directly against Account/AccountRole/Role tables

            builder.Services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = builder.Configuration["Jwt:Issuer"],
                    ValidAudience = builder.Configuration["Jwt:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
                };
            });

            // Add authorization policies for role-based access
            builder.Services.AddAuthorization(options =>
            {
                options.AddPolicy("StudentOnly", policy => policy.RequireRole("Student"));
                options.AddPolicy("TeacherOnly", policy => policy.RequireRole("Teacher"));
                options.AddPolicy("SuperadminOnly", policy => policy.RequireRole("Superadmin", "Admin", "Board"));
                options.AddPolicy("TeacherOrAdmin", policy => policy.RequireRole("Teacher", "Superadmin", "Admin", "Board"));
            });

            // Add CORS
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend",
                    policy =>
                    {
                        policy.AllowAnyOrigin()
                              .AllowAnyHeader()
                              .AllowAnyMethod();
                    });
            });

            // Dependency Injection for Repositories
            builder.Services.AddScoped<IExamRepo, ExamRepo>();
            builder.Services.AddScoped<IQuestionBankRepo, QuestionBankRepo>();
            builder.Services.AddScoped<IDashboardRepo, DashboardRepo>();

            var app = builder.Build();

            // Configure the HTTP request pipeline
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            // app.UseHttpsRedirection();

            app.UseCors("AllowFrontend"); 

            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();

            // Seed roles and test accounts
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ElsewedySchoolSysDbDevContext>();
                Models.ElsewedySchoolContextSeed.SeedAsync(db).GetAwaiter().GetResult();
            }

            app.Run();
        }
    }
}

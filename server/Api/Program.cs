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
            var jwtKey = builder.Configuration["Jwt:Key"] ?? Environment.GetEnvironmentVariable("JWT_KEY");
            var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "CAS.Api";
            var jwtAudience = builder.Configuration["Jwt:Audience"] ?? Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "CAS.Clients";

            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new InvalidOperationException("Jwt:Key must be supplied through secure configuration.");
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be supplied through secure configuration.");

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
                options.UseSqlServer(
                    connectionString,
                    sqlOptions =>
                    {
                        if (builder.Environment.IsDevelopment())
                        {
                            sqlOptions.CommandTimeout(0);
                        }
                    }));
                
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
                    ValidIssuers = new[] { jwtIssuer, "CAS.Api", "QuizesApi" },
                    ValidAudiences = new[] { jwtAudience, "CAS.Clients", "QuizesApiUsers" },
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                    NameClaimType = System.Security.Claims.ClaimTypes.NameIdentifier
                };
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        if (context.Principal?.Identity is System.Security.Claims.ClaimsIdentity identity)
                        {
                            // Map "Role"/"role" → ClaimTypes.Role (enables [Authorize(Roles=...)])
                            var roleClaim = identity.FindFirst("Role") ?? identity.FindFirst("role");
                            if (roleClaim != null && !identity.HasClaim(c => c.Type == System.Security.Claims.ClaimTypes.Role))
                                identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, roleClaim.Value));

                            // Map "AccountId"/"accountId" → ClaimTypes.NameIdentifier (fixes /student/undefined)
                            var accountIdClaim = identity.FindFirst("AccountId") ?? identity.FindFirst("accountId") ?? identity.FindFirst("sub") ?? identity.FindFirst("nameid");
                            if (accountIdClaim != null && !identity.HasClaim(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier))
                                identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, accountIdClaim.Value));
                        }
                        return Task.CompletedTask;
                    }
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

            if (app.Environment.IsDevelopment())
            {
                using var scope = app.Services.CreateScope();
                try
                {
                    var db = scope.ServiceProvider.GetRequiredService<ElsewedySchoolSysDbDevContext>();
                    Models.ElsewedySchoolContextSeed.SeedAsync(db).GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
                    logger.LogWarning("DB seeding skipped: {Message}", ex.Message);
                }
            }

            app.Run();
        }
    }
}

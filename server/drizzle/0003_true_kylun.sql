CREATE TABLE "mercadona_cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mercadona_products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"packaging" text DEFAULT '' NOT NULL,
	"thumbnail" text DEFAULT '' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_mercadona_cart_position" ON "mercadona_cart" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_mercadona_products_favorite" ON "mercadona_products" USING btree ("favorite","position");
CREATE INDEX "idx_clients_stripe_customer" ON "clients" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_clients_stripe_subscription" ON "clients" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_agencies_twilio_number" ON "agencies" USING btree ("twilio_number");
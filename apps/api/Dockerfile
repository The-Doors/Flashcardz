FROM dunglas/frankenphp:1-php8.5-bookworm

WORKDIR /app

RUN install-php-extensions pcntl pdo_pgsql mbstring zip
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

ENV APP_ENV=production \
    APP_DEBUG=false \
    XDG_CONFIG_HOME=/app/storage/framework/caddy/config \
    XDG_DATA_HOME=/app/storage/framework/caddy/data

COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --no-scripts --no-autoloader

COPY apps/api ./
RUN mkdir -p bootstrap/cache storage/app/private storage/app/public storage/framework/cache/data storage/framework/cache/locks storage/framework/sessions storage/framework/views storage/logs \
    && composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader \
    && cp vendor/laravel/octane/src/Commands/stubs/frankenphp-worker.php public/frankenphp-worker.php \
    && chown -R www-data:www-data /app

USER www-data

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD php -r 'exit(@file_get_contents("http://127.0.0.1:8000/up") === false ? 1 : 0);'

CMD ["sh", "-c", "php artisan optimize --no-interaction && exec php artisan octane:start --server=frankenphp --host=0.0.0.0 --port=8000 --workers=2 --max-requests=500 --log-level=info --no-interaction"]

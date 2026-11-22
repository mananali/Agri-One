import { Module } from '@nestjs/common';
import { CatalogController, SupplierCatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({ controllers: [CatalogController, SupplierCatalogController], providers: [CatalogService] })
export class CatalogModule {}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const DIRECTOR_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_OWNER,
  UserRole.MANAGER,
  UserRole.TEAM_LEAD,
  UserRole.HR,
];

@Injectable()
export class CompanyAccessService {
  constructor(private prisma: PrismaService) {}

  async assertDirectorCompany(userId: string, role: UserRole, companyId: string) {
    if (!DIRECTOR_ROLES.includes(role)) {
      throw new ForbiddenException('Director access required');
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    if (role === UserRole.SUPER_ADMIN) return company;
    if (role === UserRole.COMPANY_OWNER) {
      if (company.ownerId !== userId) throw new ForbiddenException('Not your company');
      return company;
    }
    const employee = await this.prisma.employee.findFirst({
      where: { userId, companyId },
    });
    if (!employee) throw new ForbiddenException('Not a member of this company');
    return company;
  }
}

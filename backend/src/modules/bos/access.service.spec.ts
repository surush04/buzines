import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CompanyAccessService } from './access.service';

describe('CompanyAccessService isolation', () => {
  const prisma = {
    company: { findUnique: jest.fn() },
    employee: { findFirst: jest.fn() },
  };
  const svc = new CompanyAccessService(prisma as never);

  it('blocks employees from director company APIs', async () => {
    await expect(svc.assertDirectorCompany('u1', UserRole.EMPLOYEE, 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks owners of a different company', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'other' });
    await expect(svc.assertDirectorCompany('u1', UserRole.COMPANY_OWNER, 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

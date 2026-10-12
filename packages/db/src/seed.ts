import { PrismaClient } from '@prisma/client'

async function seed() {
  const prisma = new PrismaClient()

  try {
    console.log('🌱 Seeding Hulu Academy database...')

    // ── Year 1 Semester 2 Full Package ──────────────────────────────
    const product = await prisma.product.upsert({
      where: { id: 'prod-y1s2-full' },
      update: {},
      create: {
        id: 'prod-y1s2-full',
        name: 'Year 1 • Semester 2 Full Tutorial Package',
        description:
          'Complete premium tutorial package for Ethiopian university freshman students (Second Semester). ' +
          'Includes 4K video lectures, PDFs, notes in Amharic & English, chapter-wise quizzes, ' +
          'past exam papers with answers, special exam-focused practice, and senior advice sessions. ' +
          'Covers all departments: Pre-Engineering, Pre-Health, Other Natural Science, Social Science.',
        type: 'TUTORIAL_PACKAGE',
        status: 'ACTIVE',
      },
    })

    console.log(`✅ Product: ${product.name}`)

    // ── Core Courses (all departments) ──────────────────────────────
    const coreCourses = [
      {
        title: 'Communicative English Language Skills 2',
        description:
          'Academic English communication skills for university freshmen — writing, reading, speaking, and listening.',
        fileType: 'mixed',
        sortOrder: 1,
      },
      {
        title: 'Civics and Moral Education',
        description:
          'Ethiopian civic values, democratic culture, human rights, and moral reasoning.',
        fileType: 'mixed',
        sortOrder: 2,
      },
      {
        title: 'Entrepreneurship',
        description:
          'Business creation, innovation, startup thinking, and Ethiopian entrepreneurship ecosystem.',
        fileType: 'mixed',
        sortOrder: 3,
      },
      {
        title: 'Emerging Technology',
        description:
          'Introduction to AI, IoT, blockchain, and other transformative technologies for all departments.',
        fileType: 'mixed',
        sortOrder: 4,
      },
      {
        title: 'Applied Mathematics 1',
        description:
          'Calculus, linear algebra, and mathematical foundations for Pre-Engineering and Natural Science students.',
        fileType: 'mixed',
        sortOrder: 5,
      },
      {
        title: 'Computer Programming',
        description:
          'Introduction to programming fundamentals — algorithms, logic, and basic coding for all departments.',
        fileType: 'mixed',
        sortOrder: 6,
      },
      {
        title: 'Biology',
        description:
          'Cell biology, genetics, and life science fundamentals for Pre-Health and Natural Science students.',
        fileType: 'mixed',
        sortOrder: 7,
      },
      {
        title: 'Chemistry',
        description:
          'General chemistry, bonding, reactions, and stoichiometry for Pre-Health and Natural Science.',
        fileType: 'mixed',
        sortOrder: 8,
      },
      {
        title: 'History',
        description:
          'Ethiopian and African history for Social Science and other departments.',
        fileType: 'mixed',
        sortOrder: 9,
      },
      {
        title: 'Economics',
        description:
          'Micro and macroeconomics fundamentals for Social Science students.',
        fileType: 'mixed',
        sortOrder: 10,
      },
      {
        title: 'Anthropology',
        description:
          'Human culture, society, and diversity studies.',
        fileType: 'mixed',
        sortOrder: 11,
      },
      {
        title: 'Global Trends',
        description:
          'Contemporary global developments, geopolitics, and world affairs.',
        fileType: 'mixed',
        sortOrder: 12,
      },
      {
        title: 'Inclusiveness',
        description:
          'Diversity, equity, disability studies, and inclusive development in Ethiopia.',
        fileType: 'mixed',
        sortOrder: 13,
      },
    ]

    // ── Additional Courses (some universities) ───────────────────────
    const additionalCourses = [
      {
        title: 'Psychology (Selected Universities)',
        description:
          'Introduction to psychological principles, human behavior, and mental health.',
        fileType: 'mixed',
        sortOrder: 14,
      },
      {
        title: 'Geography (Selected Universities)',
        description:
          'Physical and human geography with Ethiopian and African regional focus.',
        fileType: 'mixed',
        sortOrder: 15,
      },
      {
        title: 'Logic and Critical Thinking (Selected Universities)',
        description:
          'Formal logic, argumentation, fallacies, and critical reasoning skills.',
        fileType: 'mixed',
        sortOrder: 16,
      },
      {
        title: 'Physics (Selected Universities)',
        description:
          'Classical mechanics, electricity, and waves for engineering-track freshmen.',
        fileType: 'mixed',
        sortOrder: 17,
      },
    ]

    const allCourses = [...coreCourses, ...additionalCourses]

    for (const course of allCourses) {
      await prisma.material.upsert({
        where: {
          id: `mat-${course.title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40)}`,
        },
        update: {},
        create: {
          id: `mat-${course.title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40)}`,
          productId: product.id,
          title: course.title,
          description: course.description,
          fileType: course.fileType,
          sortOrder: course.sortOrder,
          status: 'ACTIVE',
        },
      })
      console.log(`  📚 Course: ${course.title}`)
    }

    console.log('\n✅ Seed complete!')
    console.log(`   Product ID: ${product.id}`)
    console.log(`   Courses seeded: ${allCourses.length}`)
    console.log('\n⚠️  Set YEAR1_SEM2_PRODUCT_ID=' + product.id + ' in your .env')
  } finally {
    await prisma.$disconnect()
  }
}

seed().catch((e) => {
  console.error('❌ Seed failed:', e)
  process.exit(1)
})
